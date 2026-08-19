// Every stored video gets a still frame beside it, under `posters/`, named
// after the video. Keeping it a convention rather than a field means nothing in
// the database has to change, and a video whose poster hasn't been made yet
// simply falls back to what the browser does today.
//
// The prefix also keeps posters out of the orphan sweep: no post references a
// poster URL, so without it they would all look abandoned.

export const POSTER_PREFIX = "posters/";

/** The poster object key for a stored video's key. */
export function posterKeyFor(videoKey: string): string {
  return `${POSTER_PREFIX}${videoKey}.jpg`;
}

/** The poster URL for a video URL, R2 or local /uploads alike. */
export function posterUrlFor(videoUrl: string): string {
  const cut = videoUrl.lastIndexOf("/");
  if (cut < 0) return `${POSTER_PREFIX}${videoUrl}.jpg`;
  return `${videoUrl.slice(0, cut)}/${POSTER_PREFIX}${videoUrl.slice(cut + 1)}.jpg`;
}

export function isPosterKey(key: string): boolean {
  return key.startsWith(POSTER_PREFIX);
}

/**
 * A marker written beside a video that defeated the transcoder, so the next
 * pass skips it instead of spending the full ffmpeg timeout on it again. Six
 * unconvertible clips were costing 45 minutes each, every pass.
 */
export const SKIP_PREFIX = "skipped/";

export function skipKeyFor(videoKey: string): string {
  return `${SKIP_PREFIX}${videoKey}`;
}

/** Keys the app keeps for its own bookkeeping — never referenced by a post, so
 *  they must be kept out of the orphan sweep. */
export function isInternalKey(key: string): boolean {
  return key.startsWith(POSTER_PREFIX) || key.startsWith(SKIP_PREFIX);
}

/**
 * Where in the clip to grab the still. The very first frame of match footage is
 * routinely a blur, a bench, or black; two seconds in the play is usually
 * underway and the frame is worth showing.
 */
export const POSTER_AT_SECONDS = 2;
