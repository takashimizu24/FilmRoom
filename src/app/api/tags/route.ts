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
    // Tag rows act as the per-team colour/grouping registry (keyed by name).
    prisma.tag.findMany({
      where: { teamId },
      select: { name: true, color: true, tagGroupId: true, tagGroup: { select: { name: true } } },
    }),
  ]);

  const metaByName = new Map(tagRows.map((t) => [t.name, t]));

  // Count is the number of tagged media items (clips) a tag would surface, so it
  // matches the clip list shown when the tag is searched. A media block is findable
  // by its own tags AND by its parent post's post-level tags.
  const counts = new Map<string, number>();
  for (const post of posts) {
    const postTagNames = post.tags.map((t) => t.name);
    const blocks = parseBlocks(post.blocks);
    for (const block of blocks) {
      if (
        block.type !== "video" &&
        block.type !== "image" &&
        block.type !== "youtube" &&
        block.type !== "carousel"
      ) {
        continue;
      }
      const searchable = new Set<string>([...(block.tags ?? []), ...postTagNames]);
      for (const name of searchable) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
  }

  const tags = [...counts.entries()]
    .map(([name, count]) => {
      const meta = metaByName.get(name);
      return {
        name,
        count,
        color: meta?.color ?? null,
        tagGroupId: meta?.tagGroupId ?? null,
        tagGroupName: meta?.tagGroup?.name ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return Response.json(tags);
}

// Set a tag's colour and/or the group it's filed under. Both are optional:
// only the keys present in the body are changed.
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const body = await request.json();
  const { teamId, name, color, tagGroupId } = body;
  if (!teamId || !name || typeof name !== "string") {
    return Response.json({ error: "teamId and name are required" }, { status: 400 });
  }
  if (!(await isTeamMember(session.user.id, teamId))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const data: { color?: string | null; tagGroupId?: string | null } = {};
  if ("color" in body) data.color = normalizeHexColor(color);
  if ("tagGroupId" in body) {
    // Only accept a group that belongs to this team.
    if (tagGroupId) {
      const group = await prisma.tagGroup.findFirst({ where: { id: tagGroupId, teamId } });
      data.tagGroupId = group ? group.id : null;
    } else {
      data.tagGroupId = null;
    }
  }

  const tag = await prisma.tag.upsert({
    where: { teamId_name: { teamId, name } },
    update: data,
    create: { name, teamId, color: data.color ?? null, tagGroupId: data.tagGroupId ?? null },
    select: { name: true, color: true, tagGroupId: true },
  });

  return Response.json(tag);
}
