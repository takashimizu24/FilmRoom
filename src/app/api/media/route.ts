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
    select: { title: true, blocks: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // Uploaded files are named `${Date.now()}-${rand}.ext`, so the leading number
  // is the upload time. For YouTube links (and any legacy names) fall back to the
  // post's creation time.
  function uploadTime(url: string, fallback: number): number {
    const base = url.split("/").pop() ?? "";
    const m = base.match(/^(\d{13})-/);
    return m ? Number(m[1]) : fallback;
  }

  const seen = new Set<string>();
  const items: {
    type: "video" | "image" | "youtube";
    url: string;
    postTitle: string;
    caption: string;
    sortTs: number;
  }[] = [];
  // Deduplicate by type + url; scanning posts newest-first means the first
  // occurrence of each url wins, so its caption is the most recently set one.
  for (const post of posts) {
    for (const b of parseBlocks(post.blocks)) {
      // Carousel items are individual clips too — surface each one for reuse.
      if (b.type === "carousel") {
        for (const it of b.items) {
          if (!it.url) continue;
          const key = `${it.type}|${it.url}`;
          if (seen.has(key)) continue;
          seen.add(key);
          items.push({
            type: it.type,
            url: it.url,
            postTitle: post.title,
            caption: b.caption ?? "",
            sortTs: uploadTime(it.url, post.createdAt.getTime()),
          });
        }
        continue;
      }
      if (b.type !== "video" && b.type !== "image" && b.type !== "youtube") continue;
      if (!b.url) continue;
      const key = `${b.type}|${b.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        type: b.type,
        url: b.url,
        postTitle: post.title,
        caption: b.caption ?? "",
        sortTs: uploadTime(b.url, post.createdAt.getTime()),
      });
    }
  }

  // Newest upload first.
  items.sort((a, b) => b.sortTs - a.sortTs);

  return Response.json(
    items.map((it) => ({ type: it.type, url: it.url, postTitle: it.postTitle, caption: it.caption }))
  );
}
