import type { Block } from "./types";

// Short human label for a block, used in the comment composer/chips to say which
// part of the post a comment is about. `#n` is the block's position (1-based).
export function blockLabel(block: Block, index: number): string {
  const n = index + 1;
  if (block.type === "text") {
    const preview = block.content.trim().replace(/\s+/g, " ").slice(0, 24);
    return preview ? `Text #${n}: ${preview}` : `Text #${n}`;
  }
  const caption = "caption" in block && block.caption ? `: ${block.caption}` : "";
  if (block.type === "carousel") {
    return `🎞 Carousel #${n} (${block.items.length})${caption}`;
  }
  const icon = block.type === "image" ? "🖼" : block.type === "video" ? "🎬" : "▶";
  const type = block.type === "youtube" ? "YouTube" : block.type === "image" ? "Image" : "Video";
  return `${icon} ${type} #${n}${caption}`;
}

// DOM id for a rendered block, so a comment can scroll to it.
export function blockAnchorId(index: number): string {
  return `post-block-${index}`;
}

/** A run of consecutive blocks shown as one set, with their original indices. */
export type BlockGroupSlice = {
  /** Index of the block that opens the set — stable id for the set. */
  startIndex: number;
  title?: string;
  items: { block: Block; index: number }[];
};

/**
 * Split a post's blocks into the sets marked by `groupStart`. Blocks before the
 * first marker form the opening set. Indices are preserved so comments, anchors
 * and tags keep pointing at the same block.
 */
export function groupBlocks(blocks: Block[]): BlockGroupSlice[] {
  const groups: BlockGroupSlice[] = [];
  blocks.forEach((block, index) => {
    const startsHere = index === 0 || block.groupStart === true;
    if (startsHere) {
      groups.push({ startIndex: index, title: block.groupTitle?.trim() || undefined, items: [] });
    }
    groups[groups.length - 1].items.push({ block, index });
  });
  return groups;
}

/** Whether the post uses grouping at all (older posts render exactly as before). */
export function hasGroups(blocks: Block[]): boolean {
  return blocks.some((b, i) => i > 0 && b.groupStart === true);
}

/** The set a given block index belongs to. */
export function groupOfIndex(blocks: Block[], index: number): BlockGroupSlice | null {
  return groupBlocks(blocks).find((g) => g.items.some((it) => it.index === index)) ?? null;
}
