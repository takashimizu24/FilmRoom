import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isTeamAdmin } from "@/lib/team";

// Remove a member from a team. Admin-only. An admin can't remove themselves here
// (that would be "leave the team", a different action) and can't remove the last
// remaining admin.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const { id: teamId, userId: targetUserId } = await params;

  if (!(await isTeamAdmin(session.user.id, teamId))) {
    return Response.json({ error: "Only a team admin can remove members" }, { status: 403 });
  }

  if (targetUserId === session.user.id) {
    return Response.json({ error: "You can't remove yourself" }, { status: 400 });
  }

  const target = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId: targetUserId, teamId } },
    select: { role: true },
  });
  if (!target) {
    return Response.json({ error: "That member isn't on this team" }, { status: 404 });
  }

  // Don't allow removing the last admin.
  if (target.role === "admin") {
    const adminCount = await prisma.teamMembership.count({ where: { teamId, role: "admin" } });
    if (adminCount <= 1) {
      return Response.json({ error: "Can't remove the last admin" }, { status: 400 });
    }
  }

  await prisma.teamMembership.delete({
    where: { userId_teamId: { userId: targetUserId, teamId } },
  });

  return Response.json({ ok: true });
}
