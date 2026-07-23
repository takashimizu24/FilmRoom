import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "./prisma";

export const ACTIVE_TEAM_COOKIE = "activeTeamId";

export async function createUniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    const existing = await prisma.team.findUnique({ where: { inviteCode: code } });
    if (!existing) return code;
  }
  throw new Error("Failed to generate a unique invite code");
}

export async function isTeamMember(userId: string, teamId: string): Promise<boolean> {
  const membership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  return !!membership;
}

/**
 * Resolves the user's active team: prefers the `activeTeamId` cookie if the
 * user is still a member of it, otherwise falls back to their first team.
 * Returns null if the user has no teams.
 */
export async function getActiveTeamId(userId: string): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieTeamId = cookieStore.get(ACTIVE_TEAM_COOKIE)?.value;

  if (cookieTeamId && (await isTeamMember(userId, cookieTeamId))) {
    return cookieTeamId;
  }

  const firstMembership = await prisma.teamMembership.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
  });

  return firstMembership?.teamId ?? null;
}
