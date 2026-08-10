import { prisma } from "@/lib/prisma";
import { deleteR2Objects, r2KeyFromUrl } from "@/lib/r2";

/**
 * Reclaiming storage without losing videos.
 *
 * Deleting an uploaded file the moment the last post stopped referencing it is
 * what made videos disappear. "Is this still referenced?" is answered by a
 * substring search over every post's JSON, and anything that made that answer
 * briefly wrong — a stale editor tab saving an older copy of a post, an edit
 * racing a background job — destroyed the only copy of the video.
 *
 * So nothing is deleted on the spot. A file that falls out of use is parked,
 * and only actually removed once it has been unreferenced for a week and is
 * still unreferenced when the sweep runs. Anything that comes back before then
 * (an undo, a stale save, a post restored) keeps its file.
 */

const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/** Park media that no post references any more. Deletes nothing. */
export async function markUnreferenced(media: { url: string; key: string }[]): Promise<void> {
  for (const { url, key } of media) {
    // Shared uploads: a file used by another post is not an orphan at all.
    const refs = await prisma.post.count({ where: { blocks: { contains: url } } });
    if (refs > 0) continue;
    await prisma.orphanMedia.upsert({
      where: { key },
      update: {}, // keep the original mark date; re-marking must not extend the grace
      create: { key, url },
    });
  }
}

/**
 * Take media off the pending list because a post references it again. Called
 * whenever a post is saved, so re-adding a clip (or saving an older copy of a
 * post) rescues its file.
 */
export async function unmarkReferenced(urls: string[]): Promise<void> {
  const keys = urls.map((u) => r2KeyFromUrl(u)).filter((k): k is string => !!k);
  if (keys.length === 0) return;
  await prisma.orphanMedia.deleteMany({ where: { key: { in: keys } } });
}

let lastSweep = 0;

/**
 * Delete parked files that are past the grace period and still unreferenced.
 * Throttled to once an hour, since it's called fire-and-forget from ordinary
 * requests; `force` runs it now (the admin maintenance endpoint).
 */
export async function sweepOrphanMedia(force = false): Promise<{ deleted: number; revived: number }> {
  const now = Date.now();
  if (!force && now - lastSweep < 60 * 60 * 1000) return { deleted: 0, revived: 0 };
  lastSweep = now;

  const due = await prisma.orphanMedia.findMany({
    where: { markedAt: { lt: new Date(now - GRACE_MS) } },
  });

  const doomed: string[] = [];
  const revived: string[] = [];
  for (const o of due) {
    // Checked again here, not just when it was parked: a week is long enough for
    // the file to have come back into use.
    const refs = await prisma.post.count({ where: { blocks: { contains: o.url } } });
    if (refs > 0) revived.push(o.key);
    else doomed.push(o.key);
  }

  if (doomed.length > 0) {
    await deleteR2Objects(doomed);
    await prisma.orphanMedia.deleteMany({ where: { key: { in: doomed } } });
  }
  if (revived.length > 0) {
    await prisma.orphanMedia.deleteMany({ where: { key: { in: revived } } });
  }

  return { deleted: doomed.length, revived: revived.length };
}
