import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isTeamMember } from "@/lib/team";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await isTeamMember(session.user.id, id))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      memberships: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!team) {
    return Response.json({ error: "Team not found" }, { status: 404 });
  }

  return Response.json(team);
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
  if (!(await isTeamMember(session.user.id, id))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const { name } = await request.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "Team name is required" }, { status: 400 });
  }

  const team = await prisma.team.update({
    where: { id },
    data: { name: name.trim() },
  });

  return Response.json(team);
}
