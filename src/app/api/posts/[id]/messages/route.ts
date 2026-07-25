import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isTeamMember } from "@/lib/team";
import { NextRequest } from "next/server";

async function assertAccess(userId: string, postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { teamId: true } });
  if (!post) return false;
  return isTeamMember(userId, post.teamId);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await assertAccess(session.user.id, id))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const messages = await prisma.message.findMany({
    where: { postId: id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return Response.json(messages);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await assertAccess(session.user.id, id))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const { content, parentId, blockRef } = await request.json();

  if (!content?.trim()) {
    return Response.json({ error: "Please enter a message" }, { status: 400 });
  }

  // A reply must point at a top-level comment on THIS post; keep threads two
  // levels deep by re-parenting a reply-to-a-reply onto its top comment.
  let resolvedParentId: string | null = null;
  if (typeof parentId === "string" && parentId) {
    const parent = await prisma.message.findFirst({
      where: { id: parentId, postId: id },
      select: { id: true, parentId: true },
    });
    if (parent) resolvedParentId = parent.parentId ?? parent.id;
  }

  const message = await prisma.message.create({
    data: {
      content: content.trim(),
      postId: id,
      userId: session.user.id,
      parentId: resolvedParentId,
      blockRef: typeof blockRef === "number" && Number.isInteger(blockRef) && blockRef >= 0 ? blockRef : null,
    },
    include: { user: { select: { name: true } } },
  });

  return Response.json(message);
}
