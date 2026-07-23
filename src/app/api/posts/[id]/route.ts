import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isTeamMember } from "@/lib/team";
import { NextRequest } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: { select: { name: true } },
      tags: true,
      group: true,
      messages: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!post) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  if (!post.teamId || !(await isTeamMember(session.user.id, post.teamId))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  return Response.json({
    ...post,
    blocks: JSON.parse(post.blocks),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.post.findUnique({ where: { id } });

  if (!existing) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  // Only the author can edit their own post.
  if (existing.authorId !== session.user.id) {
    return Response.json({ error: "Only the author can edit this post" }, { status: 403 });
  }

  const { title, blocks, tags, groupId } = await request.json();

  if (!title) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return Response.json({ error: "Content is required" }, { status: 400 });
  }

  const tagNames: string[] = Array.isArray(tags)
    ? [...new Set(tags.map((t: string) => t.trim()).filter(Boolean))]
    : [];

  // Only accept a group belonging to this post's team; groupId omitted = leave unchanged,
  // null = clear the group.
  let groupUpdate: { groupId?: string | null } = {};
  if (groupId === null) {
    groupUpdate = { groupId: null };
  } else if (typeof groupId === "string" && groupId) {
    const group = await prisma.group.findFirst({ where: { id: groupId, teamId: existing.teamId } });
    groupUpdate = { groupId: group ? group.id : null };
  }

  const post = await prisma.post.update({
    where: { id },
    data: {
      title,
      blocks: JSON.stringify(blocks),
      ...groupUpdate,
      tags: {
        set: [],
        connectOrCreate: tagNames.map((name) => ({
          where: { teamId_name: { teamId: existing.teamId, name } },
          create: { name, teamId: existing.teamId },
        })),
      },
    },
    include: { tags: true, group: true },
  });

  return Response.json(post);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.post.findUnique({ where: { id } });

  if (!existing) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  // Only the author can delete their own post.
  if (existing.authorId !== session.user.id) {
    return Response.json({ error: "Only the author can delete this post" }, { status: 403 });
  }

  await prisma.post.delete({ where: { id } });

  return Response.json({ ok: true });
}
