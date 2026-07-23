import { auth } from "@/lib/auth";
import { isTeamMember, ACTIVE_TEAM_COOKIE } from "@/lib/team";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const { teamId } = await request.json();
  if (!teamId || typeof teamId !== "string") {
    return Response.json({ error: "teamId is required" }, { status: 400 });
  }

  if (!(await isTeamMember(session.user.id, teamId))) {
    return Response.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TEAM_COOKIE, teamId, { path: "/", httpOnly: false });

  return Response.json({ ok: true });
}
