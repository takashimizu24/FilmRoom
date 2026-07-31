import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isTeamAdmin } from "@/lib/team";
import { parseBlocks } from "@/lib/tags";
import type { Block } from "@/lib/types";
import {
  getR2Client,
  r2Enabled,
  R2_BUCKET,
  r2PublicUrl,
  r2KeyFromUrl,
  deleteR2Objects,
} from "@/lib/r2";
import { convertMovToMp4 } from "@/lib/transcode";
import { Upload } from "@aws-sdk/lib-storage";
import { createReadStream, createWriteStream } from "fs";
import { unlink } from "fs/promises";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import os from "os";
import path from "path";

// One-time migration: convert already-uploaded QuickTime/HEVC (.mov) videos on
// R2 to H.264 MP4 so they play on PCs, updating the posts that reference them
// and deleting the old files. Admin-only. Processes a few per call (transcoding
// is heavy) — call repeatedly until `remaining` reaches 0.
const BATCH = 3;

function isMov(url: string): boolean {
  const u = url.toLowerCase();
  return u.endsWith(".mov") || u.endsWith(".qt");
}

type Target = { postId: string; url: string };

// Replace one media URL wherever it appears in a post's blocks.
function replaceUrl(blocks: Block[], oldUrl: string, newUrl: string): Block[] {
  return blocks.map((b) => {
    if (b.type === "video" && b.url === oldUrl) return { ...b, url: newUrl };
    if (b.type === "carousel") {
      return {
        ...b,
        items: b.items.map((it) => (it.url === oldUrl ? { ...it, url: newUrl } : it)),
      };
    }
    return b;
  });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }
  if (!r2Enabled) {
    return Response.json({ error: "R2 storage is not configured" }, { status: 400 });
  }

  // Only look at teams where the caller is an admin.
  const memberships = await prisma.teamMembership.findMany({
    where: { userId: session.user.id },
    select: { teamId: true },
  });
  const adminTeamIds: string[] = [];
  for (const m of memberships) {
    if (await isTeamAdmin(session.user.id, m.teamId)) adminTeamIds.push(m.teamId);
  }
  if (adminTeamIds.length === 0) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const posts = await prisma.post.findMany({
    where: { teamId: { in: adminTeamIds } },
    select: { id: true, blocks: true },
  });

  // Every .mov media item that lives on our bucket.
  const targets: Target[] = [];
  for (const p of posts) {
    for (const b of parseBlocks(p.blocks)) {
      const urls: string[] = [];
      if (b.type === "video") urls.push(b.url);
      if (b.type === "carousel") for (const it of b.items) urls.push(it.url);
      for (const url of urls) {
        if (isMov(url) && r2KeyFromUrl(url)) targets.push({ postId: p.id, url });
      }
    }
  }

  const batch = targets.slice(0, BATCH);
  const errors: { url: string; error: string }[] = [];
  let processed = 0;

  for (const { postId, url } of batch) {
    const oldKey = r2KeyFromUrl(url)!;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tmpIn = path.join(os.tmpdir(), `${id}-in.mov`);
    const tmpOut = path.join(os.tmpdir(), `${id}.mp4`);
    try {
      // Download the original from the bucket's public URL.
      const res = await fetch(url);
      if (!res.ok || !res.body) throw new Error(`download failed (${res.status})`);
      await pipeline(
        Readable.fromWeb(res.body as import("stream/web").ReadableStream),
        createWriteStream(tmpIn)
      );

      await convertMovToMp4(tmpIn, tmpOut);

      const newKey = `${id}.mp4`;
      await new Upload({
        client: getR2Client(),
        params: {
          Bucket: R2_BUCKET,
          Key: newKey,
          Body: createReadStream(tmpOut),
          ContentType: "video/mp4",
        },
      }).done();

      const newUrl = r2PublicUrl(newKey);

      // Re-read the post right before writing so we don't clobber a concurrent edit.
      const fresh = await prisma.post.findUnique({ where: { id: postId }, select: { blocks: true } });
      if (fresh) {
        const updated = replaceUrl(parseBlocks(fresh.blocks), url, newUrl);
        await prisma.post.update({
          where: { id: postId },
          data: { blocks: JSON.stringify(updated) },
        });
      }

      // Old file is now unreferenced — remove it so we don't double-store.
      await deleteR2Objects([oldKey]);
      processed++;
    } catch (err) {
      errors.push({ url, error: err instanceof Error ? err.message : String(err) });
    } finally {
      await unlink(tmpIn).catch(() => {});
      await unlink(tmpOut).catch(() => {});
    }
  }

  return Response.json({
    processed,
    remaining: Math.max(0, targets.length - processed),
    errors,
  });
}
