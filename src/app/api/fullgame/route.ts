import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveTeamId, isTeamMember } from "@/lib/team";
import { extractYoutubeId, fetchYoutubeTitle, youtubeWatchUrl } from "@/lib/youtube";
import { NextRequest } from "next/server";

// Quick-add a full-game video: paste a YouTube link and it becomes a post
// (a single YouTube block) tagged "fullgame", with the title pulled from
// YouTube. Lives in the normal Posts list, classified by the #fullgame tag.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const { url, teamId: requestedTeamId } = await request.json();
  const id = extractYoutubeId(typeof url === "string" ? url : "");
  if (!id) {
    return Response.json({ error: "YouTube のリンクを貼ってください" }, { status: 400 });
  }

  const teamId = requestedTeamId ?? (await getActiveTeamId(session.user.id));
  if (!teamId) {
    return Response.json({ error: "No team selected" }, { status: 400 });
  }
  if (!(await isTeamMember(session.user.id, teamId))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const canonical = youtubeWatchUrl(id);
  const title = (await fetchYoutubeTitle(canonical)) ?? "Full game";
  const blocks = [{ type: "youtube", url: canonical, startTime: 0, endTime: 0 }];

  const post = await prisma.post.create({
    data: {
      title,
      blocks: JSON.stringify(blocks),
      authorId: session.user.id,
      teamId,
      tags: {
        connectOrCreate: [
          {
            where: { teamId_name: { teamId, name: "fullgame" } },
            create: { name: "fullgame", teamId },
          },
        ],
      },
    },
    include: { tags: true },
  });

  return Response.json(post);
}
