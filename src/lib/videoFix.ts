import { prisma } from "@/lib/prisma";
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

// iPhone/QuickTime videos (usually HEVC) don't play in Chrome / on Windows /
// Android. Uploads are stored as-is so the request stays fast and never times
// out; this module converts them to H.264 MP4 afterwards, swaps the URLs in the
// posts that reference them, and deletes the originals.

export function isMovUrl(url: string): boolean {
  return /\.(mov|qt)(\?|#|$)/i.test(url);
}

/** Every media URL referenced by a set of blocks. */
export function mediaUrls(blocks: Block[]): string[] {
  const urls: string[] = [];
  for (const b of blocks) {
    if (b.type === "video" || b.type === "image") urls.push(b.url);
    else if (b.type === "carousel") for (const it of b.items) urls.push(it.url);
  }
  return urls;
}

/** Replace one media URL wherever it appears in a post's blocks. */
function replaceUrl(blocks: Block[], oldUrl: string, newUrl: string): Block[] {
  return blocks.map((b) => {
    if (b.type === "video" && b.url === oldUrl) return { ...b, url: newUrl };
    if (b.type === "carousel") {
      return { ...b, items: b.items.map((it) => (it.url === oldUrl ? { ...it, url: newUrl } : it)) };
    }
    return b;
  });
}

/**
 * Convert one stored QuickTime file to MP4 and point every post that uses it at
 * the new file. Returns true when the swap happened.
 */
export async function convertStoredMov(url: string): Promise<boolean> {
  const oldKey = r2KeyFromUrl(url);
  if (!r2Enabled || !oldKey) return false;

  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tmpIn = path.join(os.tmpdir(), `${id}-in.mov`);
  const tmpOut = path.join(os.tmpdir(), `${id}.mp4`);
  try {
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

    // Point every post using the old file at the converted one.
    const posts = await prisma.post.findMany({
      where: { blocks: { contains: url } },
      select: { id: true, blocks: true },
    });
    for (const p of posts) {
      const updated = replaceUrl(parseBlocks(p.blocks), url, newUrl);
      await prisma.post.update({ where: { id: p.id }, data: { blocks: JSON.stringify(updated) } });
    }

    // The original is now unreferenced — drop it so we don't pay to store both.
    const stillUsed = await prisma.post.count({ where: { blocks: { contains: url } } });
    if (stillUsed === 0) await deleteR2Objects([oldKey]);
    return true;
  } catch (err) {
    console.error(`mov→mp4 conversion failed for ${url}:`, err);
    return false;
  } finally {
    await unlink(tmpIn).catch(() => {});
    await unlink(tmpOut).catch(() => {});
  }
}

/**
 * Convert any QuickTime videos a post references. Safe to call fire-and-forget
 * after a post is created or edited; it never throws.
 */
export async function convertPostMovs(postId: string): Promise<void> {
  try {
    if (!r2Enabled) return;
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { blocks: true } });
    if (!post) return;
    const targets = [...new Set(mediaUrls(parseBlocks(post.blocks)).filter(isMovUrl))];
    for (const url of targets) {
      await convertStoredMov(url);
    }
  } catch (err) {
    console.error("convertPostMovs failed:", err);
  }
}
