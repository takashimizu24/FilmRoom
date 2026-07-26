import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isTeamMember } from "@/lib/team";

// Delete a comment. Allowed for the comment's author, or the post's author
// (so the coach can moderate their own post). Deleting a top-level comment also
// removes its replies, since threads are only two levels deep.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const { id, messageId } = await params;

  const post = await prisma.post.findUnique({
    where: { id },
    select: { teamId: true, authorId: true },
  });
  if (!post) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }
  if (!(await isTeamMember(session.user.id, post.teamId))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const message = await prisma.message.findFirst({
    where: { id: messageId, postId: id },
    select: { id: true, userId: true },
  });
  if (!message) {
    return Response.json({ error: "Comment not found" }, { status: 404 });
  }

  const canDelete = message.userId === session.user.id || post.authorId === session.user.id;
  if (!canDelete) {
    return Response.json({ error: "You can only delete your own comments" }, { status: 403 });
  }

  // Remove any replies to this comment first, then the comment itself.
  await prisma.message.deleteMany({ where: { parentId: messageId, postId: id } });
  await prisma.message.delete({ where: { id: messageId } });

  return Response.json({ ok: true });
}
