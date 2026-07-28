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
