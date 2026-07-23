import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isTeamMember } from "@/lib/team";
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

  const groups = await prisma.group.findMany({
    where: { teamId },
    include: { _count: { select: { posts: true } } },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(
    groups.map((g) => ({ id: g.id, name: g.name, color: g.color, count: g._count.posts }))
  );
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const { name, color, teamId } = await request.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "Group name is required" }, { status: 400 });
  }
  if (!teamId || !(await isTeamMember(session.user.id, teamId))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  try {
    const group = await prisma.group.create({
      data: { name: name.trim(), color: normalizeHexColor(color), teamId },
    });
    return Response.json(group);
  } catch {
    return Response.json({ error: "A group with that name already exists" }, { status: 409 });
  }
}
