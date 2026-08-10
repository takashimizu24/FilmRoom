import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isTeamAdmin } from "@/lib/team";
import { parseBlocks } from "@/lib/tags";
import { getR2Client, r2Enabled, R2_BUCKET, r2PublicUrl, r2KeyFromUrl } from "@/lib/r2";
import { markUnreferenced, sweepOrphanMedia } from "@/lib/mediaGc";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { convertStoredMov, mediaUrls, videoUrls } from "@/lib/videoFix";
import { NextRequest } from "next/server";

// Maintenance endpoints for stored media. Admin-only.
//   GET  → storage report (what's in the bucket, what's referenced, orphans)
//   POST → make every stored video web-ready (runs in the background)
//   POST ?cleanup=1 → queue orphaned objects for deletion (swept after a week)
//   POST ?sweep=1   → run that sweep now
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

/** Every video URL referenced by a post. */
async function referencedVideoUrls(): Promise<string[]> {
  const posts = await prisma.post.findMany({ select: { blocks: true } });
  return [...new Set(posts.flatMap((p) => videoUrls(parseBlocks(p.blocks))))];
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
  const videos = new Set(await referencedVideoUrls());
  for (const o of objects) {
    const url = r2PublicUrl(o.key);
    if (used.has(url)) {
      usedBytes += o.size;
      usedCount++;
      if (videos.has(url)) {
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
    videos: {
      count: movCount,
      MB: mb(movBytes),
      note: "referenced videos; POST here to make any not yet web-ready (faststart / 1080p cap)",
    },
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

  // Bring stored videos up to date. Files already done are skipped cheaply (the
  // marker lives on the object), so this is safe to call repeatedly.
  //
  // Run in the background and answer straight away: a single large clip can take
  // minutes to re-encode, and holding the request open for the whole backlog
  // would just time out at the proxy.
  const targets = await referencedVideoUrls();
  void (async () => {
    for (const url of targets) {
      try {
        await convertStoredMov(url);
      } catch (err) {
        console.error("fix-videos: conversion failed for", url, err);
      }
    }
    console.log(`fix-videos: finished a pass over ${targets.length} videos`);
  })();

  return Response.json({
    started: targets.length,
    note: "running in the background; GET this endpoint to see progress",
  });
}
