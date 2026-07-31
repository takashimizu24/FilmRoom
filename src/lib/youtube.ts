// Server-safe YouTube helpers (no "use client"): used by API routes to validate
// a pasted link and look up its title.

/** Extract the 11-char video id from any common YouTube share URL, or null. */
export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const u = url.trim();
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = u.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** Canonical watch URL for a video id. */
export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/**
 * Look up a video's title via YouTube's public oEmbed endpoint. No API key or
 * account is required. Returns null if the lookup fails (private/removed video,
 * network error) so the caller can fall back to a default title.
 */
export async function fetchYoutubeTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.title === "string" && data.title.trim() ? data.title.trim() : null;
  } catch {
    return null;
  }
}
