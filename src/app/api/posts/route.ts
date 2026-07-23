import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveTeamId, isTeamMember } from "@/lib/team";
import { allTagNames, parseBlocks } from "@/lib/tags";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const requestedTeamId = request.nextUrl.searchParams.get("teamId");
  const teamId = requestedTeamId ?? (await getActiveTeamId(session.user.id));

  if (!teamId) {
    return Response.json({ error: "No team selected" }, { status: 400 });
  }

  if (!(await isTeamMember(session.user.id, teamId))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const tag = request.nextUrl.searchParams.get("tag");
  const q = request.nextUrl.searchParams.get("q");
  const groupId = request.nextUrl.searchParams.get("groupId");

  const posts = await prisma.post.findMany({
    where: {
      teamId,
      ...(q ? { title: { contains: q } } : {}),
      ...(groupId ? { groupId } : {}),
    },
    include: {
      author: { select: { name: true } },
      tags: true,
      group: true,
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const parsed = posts
    .map((p) => ({ ...p, blocks: parseBlocks(p.blocks) }))
    // A tag filter matches a post if the tag is on the post itself OR on any media block.
    .filter((p) =>
      tag ? allTagNames(p.tags.map((t) => t.name), p.blocks).includes(tag) : true
    );

  return Response.json(parsed);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const { title, blocks, teamId: requestedTeamId, tags, groupId } = await request.json();

  if (!title) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return Response.json({ error: "Content is required" }, { status: 400 });
  }

  const teamId = requestedTeamId ?? (await getActiveTeamId(session.user.id));
  if (!teamId) {
    return Response.json({ error: "No team selected" }, { status: 400 });
  }

  if (!(await isTeamMember(session.user.id, teamId))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const tagNames: string[] = Array.isArray(tags)
    ? [...new Set(tags.map((t: string) => t.trim()).filter(Boolean))]
    : [];

  // Only accept a group that belongs to this team.
  let validGroupId: string | null = null;
  if (groupId) {
    const group = await prisma.group.findFirst({ where: { id: groupId, teamId } });
    validGroupId = group ? group.id : null;
  }

  const post = await prisma.post.create({
    data: {
      title,
      blocks: JSON.stringify(blocks),
      authorId: session.user.id,
      teamId,
      groupId: validGroupId,
      tags: {
        connectOrCreate: tagNames.map((name) => ({
          where: { teamId_name: { teamId, name } },
          create: { name, teamId },
        })),
      },
    },
    include: { tags: true },
  });

  return Response.json(post);
}
