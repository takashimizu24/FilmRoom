import type { Block } from "./types";

/** Tag names attached to individual media blocks (video/image/youtube). */
export function mediaTagNames(blocks: Block[]): string[] {
  const names: string[] = [];
  for (const b of blocks) {
    if (
      (b.type === "video" || b.type === "image" || b.type === "youtube") &&
      Array.isArray(b.tags)
    ) {
      for (const t of b.tags) {
        const name = t.trim();
        if (name) names.push(name);
      }
    }
  }
  return names;
}

/** Union of post-level tag names and every media block tag name (deduped). */
export function allTagNames(postTagNames: string[], blocks: Block[]): string[] {
  return [...new Set([...postTagNames, ...mediaTagNames(blocks)])];
}

/** Safely parse a Post.blocks JSON string into a Block[]. */
export function parseBlocks(raw: string): Block[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
