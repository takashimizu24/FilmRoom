import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isTeamMember, isTeamAdmin } from "@/lib/team";
import { parseBlocks } from "@/lib/tags";
import { r2KeyFromUrl } from "@/lib/r2";
import { markUnreferenced, unmarkReferenced, sweepOrphanMedia } from "@/lib/mediaGc";
import { convertPostMovs } from "@/lib/videoFix";
import type { Block } from "@/lib/types";
import { NextRequest } from "next/server";

// R2 media (public URL + object key) referenced by a post's blocks, skipping
// non-R2 URLs (YouTube, legacy /uploads).
function r2MediaFromBlocks(blocks: Block[]): { url: string; key: string }[] {
  const out: { url: string; key: string }[] = [];
  const push = (url: string) => {
    const key = r2KeyFromUrl(url);
    if (key) out.push({ url, key });
  };
  for (const b of blocks) {
    if (b.type === "video" || b.type === "image") push(b.url);
    else if (b.type === "carousel") for (const it of b.items) push(it.url);
  }
  return out;
}

/**
 * Who may change a post: its author, and any admin of its team. Every member can
 * still read it and comment on it — this only covers editing the post itself and
 * deleting it, which admins can do for the whole team.
 */
async function canManagePost(
  userId: string,
  post: { authorId: string | null; teamId: string | null }
): Promise<boolean> {
  if (post.authorId === userId) return true;
  return !!post.teamId && (await isTeamAdmin(userId, post.teamId));
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
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: { select: { name: true } },
      tags: true,
      group: true,
      messages: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!post) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  if (!post.teamId || !(await isTeamMember(session.user.id, post.teamId))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  return Response.json({
    ...post,
    blocks: JSON.parse(post.blocks),
    // The server owns the rule; the page just renders what it's told.
    canManage: await canManagePost(session.user.id, post),
  });
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
  const existing = await prisma.post.findUnique({ where: { id } });

  if (!existing) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  if (!(await canManagePost(session.user.id, existing))) {
    return Response.json(
      { error: "この投稿を編集できるのは、投稿者とチーム管理者のみです" },
      { status: 403 }
    );
  }

  const { title, blocks, tags, groupId } = await request.json();

  if (!title) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return Response.json({ error: "Content is required" }, { status: 400 });
  }

  const tagNames: string[] = Array.isArray(tags)
    ? [...new Set(tags.map((t: string) => t.trim()).filter(Boolean))]
    : [];

  // Only accept a group belonging to this post's team; groupId omitted = leave unchanged,
  // null = clear the group.
  let groupUpdate: { groupId?: string | null } = {};
  if (groupId === null) {
    groupUpdate = { groupId: null };
  } else if (typeof groupId === "string" && groupId) {
    const group = await prisma.group.findFirst({ where: { id: groupId, teamId: existing.teamId } });
    groupUpdate = { groupId: group ? group.id : null };
  }

  const post = await prisma.post.update({
    where: { id },
    data: {
      title,
      blocks: JSON.stringify(blocks),
      ...groupUpdate,
      tags: {
        set: [],
        connectOrCreate: tagNames.map((name) => ({
          where: { teamId_name: { teamId: existing.teamId, name } },
          create: { name, teamId: existing.teamId },
        })),
      },
    },
    include: { tags: true, group: true },
  });

  // Storage is reclaimed later, never here: files dropped by this edit are only
  // parked (see src/lib/mediaGc.ts). Files this edit brings back are un-parked
  // first, so re-adding a clip — or saving a copy of the post made before it was
  // removed — keeps the video alive.
  const oldMedia = r2MediaFromBlocks(parseBlocks(existing.blocks));
  const newMedia = r2MediaFromBlocks(blocks as Block[]);
  const newUrls = new Set(newMedia.map((m) => m.url));
  await unmarkReferenced(newMedia.map((m) => m.url));
  await markUnreferenced(oldMedia.filter((m) => !newUrls.has(m.url)));
  void sweepOrphanMedia();

  // Convert any newly added QuickTime clips in the background (see the upload
  // route: transcoding inside a request timed out on large files).
  void convertPostMovs(id);

  return Response.json(post);
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
  const existing = await prisma.post.findUnique({ where: { id } });

  if (!existing) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  if (!(await canManagePost(session.user.id, existing))) {
    return Response.json(
      { error: "この投稿を削除できるのは、投稿者とチーム管理者のみです" },
      { status: 403 }
    );
  }

  const media = r2MediaFromBlocks(parseBlocks(existing.blocks));
  await prisma.post.delete({ where: { id } });

  // Park this post's uploads rather than deleting them; the sweep removes them
  // a week from now if nothing has picked them up again.
  await markUnreferenced(media);
  void sweepOrphanMedia();

  return Response.json({ ok: true });
}
