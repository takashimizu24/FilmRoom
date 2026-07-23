import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ACTIVE_TEAM_COOKIE } from "@/lib/team";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const { inviteCode } = await request.json();
  if (!inviteCode || typeof inviteCode !== "string") {
    return Response.json({ error: "Invite code is required" }, { status: 400 });
  }

  const team = await prisma.team.findUnique({
    where: { inviteCode: inviteCode.trim().toUpperCase() },
  });

  if (!team) {
    return Response.json({ error: "Invalid invite code" }, { status: 404 });
  }

  await prisma.teamMembership.upsert({
    where: { userId_teamId: { userId: session.user.id, teamId: team.id } },
    update: {},
    create: { userId: session.user.id, teamId: team.id },
  });

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TEAM_COOKIE, team.id, { path: "/", httpOnly: false });

  return Response.json(team);
}
