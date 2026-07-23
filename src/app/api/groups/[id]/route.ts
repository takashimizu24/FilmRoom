import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isTeamMember } from "@/lib/team";
import { normalizeHexColor } from "@/lib/color";
import { NextRequest } from "next/server";

async function loadIfMember(userId: string, id: string) {
  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) return { error: "Group not found", status: 404 as const };
  if (!(await isTeamMember(userId, group.teamId))) {
    return { error: "Not a member of this team", status: 403 as const };
  }
  return { group };
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
  const res = await loadIfMember(session.user.id, id);
  if ("error" in res) return Response.json({ error: res.error }, { status: res.status });

  const body = await request.json();
  const data: { name?: string; color?: string | null } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if ("color" in body) data.color = normalizeHexColor(body.color);

  const group = await prisma.group.update({ where: { id }, data });
  return Response.json(group);
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
  const res = await loadIfMember(session.user.id, id);
  if ("error" in res) return Response.json({ error: res.error }, { status: res.status });

  // Posts keep existing; their groupId is set to null (relation is optional).
  await prisma.group.delete({ where: { id } });
  return Response.json({ ok: true });
}
