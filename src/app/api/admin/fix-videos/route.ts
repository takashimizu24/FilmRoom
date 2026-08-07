import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isTeamAdmin } from "@/lib/team";
import { parseBlocks } from "@/lib/tags";
import { getR2Client, r2Enabled, R2_BUCKET, r2PublicUrl, deleteR2Objects } from "@/lib/r2";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { convertStoredMov, isMovUrl, mediaUrls } from "@/lib/videoFix";
import { NextRequest } from "next/server";

// Maintenance endpoints for stored media. Admin-only.
//   GET  → storage report (what's in the bucket, what's referenced, orphans)
//   POST → convert leftover QuickTime files to MP4 (a few per call)
//   POST ?cleanup=1 → delete orphaned objects older than a day
const BATCH = 2;
const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;

async function requireAdmin(userId: string): Promise<string[] | null> {
  const memberships = await prisma.teamMembership.findMany({
    where: { userId },
    select: { teamId: true },
  });
  const adminTeamIds: string[] = [];
  for (const m of memberships) {
    if (await isTeamAdmin(userId, m.teamId)) adminTeamIds.push(m.teamId);
  }
  return adminTeamIds.length ? adminTeamIds : null;
}

/** Every object in the bucket, with size and age. */
async function listBucket(): Promise<{ key: string; size: number; modified: Date }[]> {
  const client = getR2Client();
  const out: { key: string; size: number; modified: Date }[] = [];
  let token: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: R2_BUCKET, ContinuationToken: token })
    );
    for (const o of res.Contents ?? []) {
      if (o.Key) out.push({ key: o.Key, size: o.Size ?? 0, modified: o.LastModified ?? new Date(0) });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}

/** URLs referenced by any post in the database. */
async function referencedUrls(): Promise<Set<string>> {
  const posts = await prisma.post.findMany({ select: { blocks: true } });
  const urls = new Set<string>();
  for (const p of posts) for (const u of mediaUrls(parseBlocks(p.blocks))) urls.add(u);
  return urls;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Login required" }, { status: 401 });
  if (!r2Enabled) return Response.json({ error: "R2 storage is not configured" }, { status: 400 });
  if (!(await requireAdmin(session.user.id))) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const [objects, used] = await Promise.all([listBucket(), referencedUrls()]);
  const now = Date.now();

  let usedBytes = 0;
  let orphanBytes = 0;
  let orphanCount = 0;
  let movBytes = 0;
  let movCount = 0;
  for (const o of objects) {
    const url = r2PublicUrl(o.key);
    if (used.has(url)) {
      usedBytes += o.size;
      if (isMovUrl(url)) {
        movBytes += o.size;
        movCount++;
      }
    } else if (now - o.modified.getTime() > ORPHAN_MIN_AGE_MS) {
      orphanBytes += o.size;
      orphanCount++;
    }
  }

  const mb = (n: number) => Math.round((n / 1024 / 1024) * 10) / 10;
  return Response.json({
    objects: objects.length,
    totalMB: mb(objects.reduce((s, o) => s + o.size, 0)),
    inUse: { count: objects.length - orphanCount, MB: mb(usedBytes) },
    orphans: { count: orphanCount, MB: mb(orphanBytes), note: "older than 24h, not used by any post" },
    unconvertedMov: { count: movCount, MB: mb(movBytes) },
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Login required" }, { status: 401 });
  if (!r2Enabled) return Response.json({ error: "R2 storage is not configured" }, { status: 400 });
  if (!(await requireAdmin(session.user.id))) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  // Sweep abandoned uploads (a file was uploaded but the post was never saved).
  // Files still referenced by a post are never touched. `minAgeMs=0` also sweeps
  // very recent leftovers — only safe when nobody is mid-compose.
  if (request.nextUrl.searchParams.get("cleanup")) {
    const minAge = request.nextUrl.searchParams.get("all")
      ? 0
      : ORPHAN_MIN_AGE_MS;
    const [objects, used] = await Promise.all([listBucket(), referencedUrls()]);
    const now = Date.now();
    const orphans = objects.filter(
      (o) => !used.has(r2PublicUrl(o.key)) && now - o.modified.getTime() >= minAge
    );
    await deleteR2Objects(orphans.map((o) => o.key));
    return Response.json({
      deleted: orphans.length,
      freedMB: Math.round((orphans.reduce((s, o) => s + o.size, 0) / 1024 / 1024) * 10) / 10,
    });
  }

  // Convert QuickTime files that are still referenced by posts.
  const posts = await prisma.post.findMany({ select: { blocks: true } });
  const targets = [
    ...new Set(posts.flatMap((p) => mediaUrls(parseBlocks(p.blocks))).filter(isMovUrl)),
  ];

  const batch = targets.slice(0, BATCH);
  let processed = 0;
  for (const url of batch) {
    if (await convertStoredMov(url)) processed++;
  }

  return Response.json({ processed, remaining: Math.max(0, targets.length - processed) });
}
