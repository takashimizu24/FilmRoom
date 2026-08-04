import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isTeamMember, isTeamAdmin } from "@/lib/team";
import { parseBlocks } from "@/lib/tags";
import { r2KeyFromUrl, deleteR2Objects } from "@/lib/r2";
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

// Delete a whole team — admin only. Removes the team's posts (and their comments,
// which cascade), then the team itself (memberships, tags and groups cascade),
// and finally cleans up any now-unreferenced R2 media.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await isTeamAdmin(session.user.id, id))) {
    return Response.json({ error: "Only an admin can delete the team" }, { status: 403 });
  }

  // Collect the media referenced by this team's posts before deleting them.
  const posts = await prisma.post.findMany({
    where: { teamId: id },
    select: { blocks: true },
  });
  const candidateKeys = new Set<string>();
  const candidateUrls: { url: string; key: string }[] = [];
  for (const p of posts) {
    for (const b of parseBlocks(p.blocks)) {
      if (b.type === "video" || b.type === "image") {
        const key = r2KeyFromUrl(b.url);
        if (key && !candidateKeys.has(key)) { candidateKeys.add(key); candidateUrls.push({ url: b.url, key }); }
      } else if (b.type === "carousel") {
        for (const it of b.items) {
          const key = r2KeyFromUrl(it.url);
          if (key && !candidateKeys.has(key)) { candidateKeys.add(key); candidateUrls.push({ url: it.url, key }); }
        }
      }
    }
  }

  // Posts have no DB-level cascade from Team, so delete them first (their
  // messages cascade); then the team cascades memberships, tags and groups.
  await prisma.post.deleteMany({ where: { teamId: id } });
  await prisma.team.delete({ where: { id } });

  // Delete media that no surviving post references (files can be shared).
  const orphaned: string[] = [];
  for (const { url, key } of candidateUrls) {
    const refs = await prisma.post.count({ where: { blocks: { contains: url } } });
    if (refs === 0) orphaned.push(key);
  }
  await deleteR2Objects(orphaned);

  return Response.json({ ok: true });
}
