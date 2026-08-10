import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isTeamAdmin } from "@/lib/team";
import { parseBlocks } from "@/lib/tags";
import { getR2Client, r2Enabled, R2_BUCKET, r2PublicUrl, r2KeyFromUrl } from "@/lib/r2";
import { markUnreferenced, sweepOrphanMedia } from "@/lib/mediaGc";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { convertStoredMov, isMovUrl, mediaUrls } from "@/lib/videoFix";
import { NextRequest } from "next/server";

// Maintenance endpoints for stored media. Admin-only.
//   GET  → storage report (what's in the bucket, what's referenced, orphans)
//   POST → convert leftover QuickTime files to MP4 (a few per call)
//   POST ?cleanup=1 → queue orphaned objects for deletion (swept after a week)
//   POST ?sweep=1   → run that sweep now
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

  // The reverse of an orphan: a post still points at a file that is no longer in
  // the bucket. Those play as a silent black box, so surface them by name.
  const present = new Set(objects.map((o) => r2PublicUrl(o.key)));
  const brokenRefs: string[] = [];
  for (const url of used) {
    if (r2KeyFromUrl(url) && !present.has(url)) brokenRefs.push(url);
  }

  let usedBytes = 0;
  let usedCount = 0;
  let orphanBytes = 0;
  let orphanCount = 0;
  let movBytes = 0;
  let movCount = 0;
  for (const o of objects) {
    const url = r2PublicUrl(o.key);
    if (used.has(url)) {
      usedBytes += o.size;
      usedCount++;
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
    inUse: { count: usedCount, MB: mb(usedBytes) },
    orphans: { count: orphanCount, MB: mb(orphanBytes), note: "older than 24h, not used by any post" },
    unconvertedMov: { count: movCount, MB: mb(movBytes) },
    pendingDeletion: {
      count: await prisma.orphanMedia.count(),
      note: "queued, still in storage — recoverable until the sweep runs",
    },
    brokenRefs: {
      count: brokenRefs.length,
      note: "referenced by a post but missing from storage — needs re-uploading",
      urls: brokenRefs,
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Login required" }, { status: 401 });
  if (!r2Enabled) return Response.json({ error: "R2 storage is not configured" }, { status: 400 });
  if (!(await requireAdmin(session.user.id))) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  // Run the pending-deletion sweep now instead of waiting for it to be picked up
  // by ordinary traffic.
  if (request.nextUrl.searchParams.get("sweep")) {
    return Response.json(await sweepOrphanMedia(true));
  }

  // Queue abandoned uploads (a file was uploaded but the post was never saved).
  // Nothing is deleted here any more — the files are parked and removed by the
  // sweep a week later, and only if still unreferenced then. This used to delete
  // on the spot, which meant one wrong answer to "is this referenced?" destroyed
  // the only copy of a video.
  if (request.nextUrl.searchParams.get("cleanup")) {
    const minAge = request.nextUrl.searchParams.get("all")
      ? 0
      : ORPHAN_MIN_AGE_MS;
    const [objects, used] = await Promise.all([listBucket(), referencedUrls()]);
    const now = Date.now();
    const orphans = objects.filter(
      (o) => !used.has(r2PublicUrl(o.key)) && now - o.modified.getTime() >= minAge
    );
    await markUnreferenced(orphans.map((o) => ({ key: o.key, url: r2PublicUrl(o.key) })));
    return Response.json({
      queuedForDeletion: orphans.length,
      MB: Math.round((orphans.reduce((s, o) => s + o.size, 0) / 1024 / 1024) * 10) / 10,
      note: "deleted by the sweep after 7 days, unless a post uses them again",
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
