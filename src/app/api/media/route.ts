import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isTeamMember, getActiveTeamId } from "@/lib/team";
import { parseBlocks } from "@/lib/tags";
import { NextRequest } from "next/server";

// Distinct media (uploaded videos/images and YouTube links) already used across
// the team's posts, so it can be reused in a new post without re-uploading or
// re-typing. Deduplicated by type + url, newest first.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const teamId = request.nextUrl.searchParams.get("teamId") ?? (await getActiveTeamId(session.user.id));
  if (!teamId) {
    return Response.json({ error: "No team selected" }, { status: 400 });
  }
  if (!(await isTeamMember(session.user.id, teamId))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const posts = await prisma.post.findMany({
    where: { teamId },
    select: { title: true, blocks: true },
    orderBy: { createdAt: "desc" },
  });

  const seen = new Set<string>();
  const items: { type: "video" | "image" | "youtube"; url: string; postTitle: string }[] = [];
  for (const post of posts) {
    for (const b of parseBlocks(post.blocks)) {
      if (b.type !== "video" && b.type !== "image" && b.type !== "youtube") continue;
      if (!b.url) continue;
      const key = `${b.type}|${b.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ type: b.type, url: b.url, postTitle: post.title });
    }
  }

  return Response.json(items);
}
