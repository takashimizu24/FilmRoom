import { prisma } from "@/lib/prisma";
import { parseBlocks } from "@/lib/tags";
import type { Block } from "@/lib/types";
import {
  getR2Client,
  r2Enabled,
  R2_BUCKET,
  r2KeyFromUrl,
  r2ObjectMetadata,
} from "@/lib/r2";
import { convertMovToMp4, extractPoster, plannedFix, probeVideo } from "@/lib/transcode";
import { POSTER_AT_SECONDS, posterKeyFor, skipKeyFor } from "@/lib/posters";
import { Upload } from "@aws-sdk/lib-storage";
import { createReadStream, createWriteStream } from "fs";
import { unlink } from "fs/promises";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import os from "os";
import path from "path";

// Uploads are stored exactly as the camera wrote them, so the request stays
// fast and never times out; this module makes them web-ready afterwards.
//
// It used to look only at QuickTime files, on the grounds that everything else
// "was already H.264 MP4". That left two ways for a video to play badly or not
// at all, both of which came from a PC or a good camera rather than a phone:
// a file with its index at the end (playback can't start until the whole thing
// has been fetched), and a 4K/high-bitrate file that a phone on mobile data
// can't keep up with. Both look like "slow" or "won't play". Every video is now
// checked: re-wrapped if that's all it needs, re-encoded if it's too heavy.
//
// The converted video is written back over the SAME object, so the URL never
// changes. That matters more than it looks: this used to upload the MP4 under a
// new name, rewrite every post that referenced the original, and delete the
// original. Anything still holding the old URL — an open post page, an edit tab
// loaded a minute earlier, the "Reuse" media list — then pointed at a file that
// no longer existed, and saving from that stale copy put the dead URL back into
// the post for good. Overwriting in place removes the whole class of problem:
// there is only ever one object per video, and it is never deleted here.

export function isMovUrl(url: string): boolean {
  return /\.(mov|qt)(\?|#|$)/i.test(url);
}

/** Only the video URLs in a set of blocks — images are never transcoded. */
export function videoUrls(blocks: Block[]): string[] {
  const urls: string[] = [];
  for (const b of blocks) {
    if (b.type === "video") urls.push(b.url);
    else if (b.type === "carousel") {
      for (const it of b.items) if (it.type === "video") urls.push(it.url);
    }
  }
  return urls;
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

/**
 * Make one stored video web-ready and write it back over the same object.
 * Returns true when the file was rewritten.
 */
export async function convertStoredMov(url: string, force = false): Promise<boolean> {
  const key = r2KeyFromUrl(url);
  if (!r2Enabled || !key) return false;

  // A clip that already defeated the transcoder is left alone. Without this,
  // every pass spends the whole 45-minute ffmpeg timeout on it again — six such
  // clips were burning four and a half hours of CPU per pass, forever.
  if (!force && (await r2ObjectMetadata(skipKeyFor(key)))) return false;

  // Already done. Recorded on the object itself rather than in the database, so
  // the two can never disagree, and so a post being saved repeatedly doesn't
  // re-run ffmpeg over a file that is already fine. If this check ever fails
  // open (R2 unreachable), a second pass is still lossless: the file is H.264 by
  // then, and convertMovToMp4 only re-wraps H.264 rather than re-encoding it.
  const meta = await r2ObjectMetadata(key);
  if (meta?.converted === "1") return false;

  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tmpIn = path.join(os.tmpdir(), `${id}-in`);
  const tmpOut = path.join(os.tmpdir(), `${id}.mp4`);
  try {
    // Probing can read the object over HTTP, so start there and only stage a
    // local copy when that isn't usable (or when an encode needs one, below).
    let source = url;
    let info = await probeVideo(url);
    if (!info) {
      const res = await fetch(url);
      if (!res.ok || !res.body) throw new Error(`download failed (${res.status})`);
      await pipeline(
        Readable.fromWeb(res.body as import("stream/web").ReadableStream),
        createWriteStream(tmpIn)
      );
      source = tmpIn;
      info = await probeVideo(tmpIn);
    }

    const plan = plannedFix(info);
    if (plan === "none") return false; // unreadable — better left as it is

    // Re-encoding straight from the object URL means ffmpeg pulls the whole
    // file back over the network as it decodes, and on a 300MB 4K clip that is
    // what pushed the job past its timeout every time. Fetch it once, then
    // encode from disk. A remux is I/O-light and can stay remote.
    if (plan === "encode" && source === url) {
      const res = await fetch(url);
      if (!res.ok || !res.body) throw new Error(`download failed (${res.status})`);
      await pipeline(
        Readable.fromWeb(res.body as import("stream/web").ReadableStream),
        createWriteStream(tmpIn)
      );
      source = tmpIn;
    }

    await convertMovToMp4(source, tmpOut, plan);

    // Same key. A PUT is atomic per object, so readers see either the old video
    // or the new one — never a missing file. The extension stays .mov; browsers
    // go by Content-Type, which is now video/mp4.
    await new Upload({
      client: getR2Client(),
      params: {
        Bucket: R2_BUCKET,
        Key: key,
        Body: createReadStream(tmpOut),
        ContentType: "video/mp4",
        Metadata: { converted: "1" },
        // The bytes are final now, so they can be cached hard. Before this the
        // object carries a short TTL (see the upload route) precisely so this
        // replacement reaches viewers quickly.
        CacheControl: "public, max-age=31536000, immutable",
      },
    }).done();

    return true;
  } catch (err) {
    // The original is untouched, so the video still plays wherever it played
    // before (Safari/iPhone) — it just isn't fixed for Chrome yet.
    console.error(`mov→mp4 conversion failed for ${url}:`, err);
    // Remember the failure so the next pass doesn't spend the same 45 minutes
    // rediscovering it. `?force=1` on the admin endpoint retries regardless.
    try {
      await new Upload({
        client: getR2Client(),
        params: {
          Bucket: R2_BUCKET,
          Key: skipKeyFor(key),
          Body: Buffer.from(String(err).slice(0, 500)),
          ContentType: "text/plain",
        },
      }).done();
    } catch {
      // Best effort — a missing marker only costs another attempt.
    }
    return false;
  } finally {
    await unlink(tmpIn).catch(() => {});
    await unlink(tmpOut).catch(() => {});
  }
}

/**
 * Make sure a stored video has its poster frame beside it.
 *
 * The poster is what lets a page full of clips appear at once: the browser
 * shows it without touching the video, and the video itself is only fetched
 * when someone actually presses play.
 */
export async function ensurePoster(url: string): Promise<boolean> {
  const key = r2KeyFromUrl(url);
  if (!r2Enabled || !key) return false;

  const posterKey = posterKeyFor(key);
  if (await r2ObjectMetadata(posterKey)) return false; // already there

  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tmpIn = path.join(os.tmpdir(), `${id}-poster-in`);
  const tmpOut = path.join(os.tmpdir(), `${id}.jpg`);
  try {
    // ffmpeg can usually seek the object over HTTP; fall back to a local copy.
    let source = url;
    if (!(await probeVideo(url))) {
      const res = await fetch(url);
      if (!res.ok || !res.body) throw new Error(`download failed (${res.status})`);
      await pipeline(
        Readable.fromWeb(res.body as import("stream/web").ReadableStream),
        createWriteStream(tmpIn)
      );
      source = tmpIn;
    }

    try {
      await extractPoster(source, tmpOut, POSTER_AT_SECONDS);
    } catch {
      // Shorter than the grab point — take the opening frame instead.
      await extractPoster(source, tmpOut, 0);
    }

    await new Upload({
      client: getR2Client(),
      params: {
        Bucket: R2_BUCKET,
        Key: posterKey,
        Body: createReadStream(tmpOut),
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      },
    }).done();
    return true;
  } catch (err) {
    // No poster just means the old behaviour for this one clip.
    console.error(`poster failed for ${url}:`, err);
    return false;
  } finally {
    await unlink(tmpIn).catch(() => {});
    await unlink(tmpOut).catch(() => {});
  }
}

/**
 * Make every video a post references web-ready, and give each one a poster.
 * Safe to call fire-and-forget after a post is created or edited; never throws.
 */
export async function convertPostMovs(postId: string, force = false): Promise<void> {
  try {
    if (!r2Enabled) return;
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { blocks: true } });
    if (!post) return;
    const targets = [...new Set(videoUrls(parseBlocks(post.blocks)))];
    for (const url of targets) {
      await convertStoredMov(url, force);
      // After the conversion, so the still comes from the final file.
      await ensurePoster(url);
    }
  } catch (err) {
    console.error("convertPostMovs failed:", err);
  }
}
