import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createUniqueInviteCode, ACTIVE_TEAM_COOKIE } from "@/lib/team";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const memberships = await prisma.teamMembership.findMany({
    where: { userId: session.user.id },
    include: { team: true },
    orderBy: { joinedAt: "asc" },
  });

  return Response.json(memberships.map((m) => m.team));
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const { name } = await request.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "Team name is required" }, { status: 400 });
  }

  const inviteCode = await createUniqueInviteCode();

  const team = await prisma.team.create({
    data: {
      name: name.trim(),
      inviteCode,
      memberships: {
        create: { userId: session.user.id },
      },
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TEAM_COOKIE, team.id, { path: "/", httpOnly: false });

  return Response.json(team);
}
