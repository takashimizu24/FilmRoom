import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveTeamId, isTeamMember } from "@/lib/team";
import { parseBlocks } from "@/lib/tags";
import { NextRequest } from "next/server";

// Activity feed for the "お知らせ" (notifications) screen: recent posts and
// comments in the team, newest first. Derived from existing data — no separate
// notifications table — so it always reflects reality without extra writes.
const LIMIT = 40;

type ActivityItem = {
  kind: "post" | "comment";
  id: string;
  postId: string;
  postTitle: string;
  actorId: string;
  actorName: string;
  createdAt: string;
  media: "video" | "image" | null; // for posts: what kind of content was added
  snippet: string | null; // for comments: the text
};

function postMedia(blocks: ReturnType<typeof parseBlocks>): "video" | "image" | null {
  let hasImage = false;
  for (const b of blocks) {
    if (b.type === "video" || b.type === "youtube") return "video";
    if (b.type === "carousel") {
      if (b.items.some((it) => it.type === "video")) return "video";
      hasImage = true;
    }
    if (b.type === "image") hasImage = true;
  }
  return hasImage ? "image" : null;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const teamId =
    request.nextUrl.searchParams.get("teamId") ?? (await getActiveTeamId(session.user.id));
  if (!teamId) {
    return Response.json({ error: "No team selected" }, { status: 400 });
  }
  if (!(await isTeamMember(session.user.id, teamId))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const [posts, messages] = await Promise.all([
    prisma.post.findMany({
      where: { teamId },
      select: { id: true, title: true, createdAt: true, authorId: true, blocks: true, author: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
    prisma.message.findMany({
      where: { post: { teamId } },
      select: {
        id: true,
        content: true,
        createdAt: true,
        userId: true,
        postId: true,
        user: { select: { name: true } },
        post: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
  ]);

  const items: ActivityItem[] = [
    ...posts.map((p) => ({
      kind: "post" as const,
      id: p.id,
      postId: p.id,
      postTitle: p.title,
      actorId: p.authorId,
      actorName: p.author.name,
      createdAt: p.createdAt.toISOString(),
      media: postMedia(parseBlocks(p.blocks)),
      snippet: null,
    })),
    ...messages.map((m) => ({
      kind: "comment" as const,
      id: m.id,
      postId: m.postId,
      postTitle: m.post.title,
      actorId: m.userId,
      actorName: m.user.name,
      createdAt: m.createdAt.toISOString(),
      media: null,
      snippet: m.content.length > 80 ? m.content.slice(0, 80) + "…" : m.content,
    })),
  ]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, LIMIT);

  return Response.json(items);
}
