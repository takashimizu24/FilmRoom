import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isTeamMember } from "@/lib/team";
import { parseBlocks } from "@/lib/tags";
import { normalizeHexColor } from "@/lib/color";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const teamId = request.nextUrl.searchParams.get("teamId");
  if (!teamId) {
    return Response.json({ error: "teamId is required" }, { status: 400 });
  }

  if (!(await isTeamMember(session.user.id, teamId))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const [posts, tagRows] = await Promise.all([
    prisma.post.findMany({
      where: { teamId },
      select: { blocks: true, tags: { select: { name: true } } },
    }),
    // Tag rows act as the per-team colour registry (keyed by name).
    prisma.tag.findMany({ where: { teamId }, select: { name: true, color: true } }),
  ]);

  const colorByName = new Map(tagRows.map((t) => [t.name, t.color]));

  // Count is the number of tagged media items (clips) a tag would surface, so it
  // matches the clip list shown when the tag is searched. A media block is findable
  // by its own tags AND by its parent post's post-level tags.
  const counts = new Map<string, number>();
  for (const post of posts) {
    const postTagNames = post.tags.map((t) => t.name);
    const blocks = parseBlocks(post.blocks);
    for (const block of blocks) {
      if (block.type !== "video" && block.type !== "image" && block.type !== "youtube") {
        continue;
      }
      const searchable = new Set<string>([...(block.tags ?? []), ...postTagNames]);
      for (const name of searchable) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
  }

  const tags = [...counts.entries()]
    .map(([name, count]) => ({ name, count, color: colorByName.get(name) ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return Response.json(tags);
}

// Set (or clear) the colour of a tag by name for a team.
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const { teamId, name, color } = await request.json();
  if (!teamId || !name || typeof name !== "string") {
    return Response.json({ error: "teamId and name are required" }, { status: 400 });
  }
  if (!(await isTeamMember(session.user.id, teamId))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const normalized = normalizeHexColor(color);
  const tag = await prisma.tag.upsert({
    where: { teamId_name: { teamId, name } },
    update: { color: normalized },
    create: { name, teamId, color: normalized },
  });

  return Response.json({ name: tag.name, color: tag.color });
}
