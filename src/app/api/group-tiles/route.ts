import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveTeamId, isTeamMember } from "@/lib/team";
import { parseBlocks } from "@/lib/tags";
import { videoUrls } from "@/lib/videoFix";
import { NextRequest } from "next/server";

/**
 * What the group picker needs, in one request: each group with how many posts
 * it holds and a cover taken from its most recent clip. Kept separate from
 * /api/groups because that response is consumed by the editors and the filter
 * menu, which have no use for covers and shouldn't pay to compute them.
 */
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

  const [groups, posts] = await Promise.all([
    prisma.group.findMany({ where: { teamId }, orderBy: { createdAt: "asc" } }),
    prisma.post.findMany({
      where: { teamId },
      select: { groupId: true, blocks: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // One pass, newest first, so the first clip seen for a group is its newest.
  const cover = new Map<string, string>();
  const count = new Map<string, number>();
  let allCover: string | null = null;
  for (const p of posts) {
    const key = p.groupId ?? "";
    count.set(key, (count.get(key) ?? 0) + 1);
    if (cover.has(key) && allCover) continue;
    const first = videoUrls(parseBlocks(p.blocks))[0];
    if (!first) continue;
    if (!cover.has(key)) cover.set(key, first);
    allCover ??= first;
  }

  return Response.json({
    all: { count: posts.length, cover: allCover },
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      count: count.get(g.id) ?? 0,
      cover: cover.get(g.id) ?? null,
    })),
  });
}
