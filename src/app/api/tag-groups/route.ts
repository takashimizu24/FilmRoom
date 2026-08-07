import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isTeamMember } from "@/lib/team";
import { NextRequest } from "next/server";

// Named buckets that keep a growing tag list browsable. A tag belongs to one
// group or none; deleting a group just un-files its tags (they aren't removed).

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const teamId = request.nextUrl.searchParams.get("teamId");
  if (!teamId) return Response.json({ error: "teamId is required" }, { status: 400 });
  if (!(await isTeamMember(session.user.id, teamId))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const groups = await prisma.tagGroup.findMany({
    where: { teamId },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  return Response.json(groups);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const { teamId, name } = await request.json();
  if (!teamId || typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "teamId and name are required" }, { status: 400 });
  }
  if (!(await isTeamMember(session.user.id, teamId))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const existing = await prisma.tagGroup.findUnique({
    where: { teamId_name: { teamId, name: name.trim() } },
  });
  if (existing) return Response.json({ error: "同じ名前のグループがあります" }, { status: 409 });

  const group = await prisma.tagGroup.create({
    data: { teamId, name: name.trim() },
    select: { id: true, name: true },
  });
  return Response.json(group);
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const { id, name } = await request.json();
  if (!id || typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "id and name are required" }, { status: 400 });
  }

  const group = await prisma.tagGroup.findUnique({ where: { id }, select: { teamId: true } });
  if (!group) return Response.json({ error: "Group not found" }, { status: 404 });
  if (!(await isTeamMember(session.user.id, group.teamId))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const updated = await prisma.tagGroup.update({
    where: { id },
    data: { name: name.trim() },
    select: { id: true, name: true },
  });
  return Response.json(updated);
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  const group = await prisma.tagGroup.findUnique({ where: { id }, select: { teamId: true } });
  if (!group) return Response.json({ error: "Group not found" }, { status: 404 });
  if (!(await isTeamMember(session.user.id, group.teamId))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  // The tags survive — they just become ungrouped (FK is ON DELETE SET NULL).
  await prisma.tagGroup.delete({ where: { id } });
  return Response.json({ ok: true });
}
