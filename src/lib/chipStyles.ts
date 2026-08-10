import type { CSSProperties } from "react";
import { hexAlpha } from "./color";

// The group filter chips are finished like the group badge on a card: squared
// (a category, not a #tag), a light on the top edge, the colour ring drawn as an
// inset shadow, and a small drop shadow. Selection only turns the tint and the
// ring up, plus a soft halo — the shape never changes.
export const groupChipClass =
  "px-3 py-1 rounded-md text-xs font-medium backdrop-blur-md backdrop-saturate-150 transition";

export function groupChipStyle(color: string | null, active: boolean): CSSProperties {
  // The "All groups" chip has no colour of its own, so it is drawn from the
  // theme tokens instead — a fixed grey would vanish on a light ground.
  if (!color) {
    return {
      backgroundColor: active ? "var(--lift-3)" : "var(--lift)",
      color: active ? "var(--n-100)" : "var(--n-300)",
      boxShadow: `inset 0 1px 0 var(--sheen-line), inset 0 0 0 1px ${
        active ? "var(--line-strong)" : "var(--line)"
      }, 0 1px 3px var(--chip-drop)`,
    };
  }
  const tint = hexAlpha(color, active ? 0.36 : 0.16) ?? undefined;
  const ring = hexAlpha(color, active ? 0.85 : 0.32) ?? undefined;
  const halo = active ? `, 0 0 0 3px ${hexAlpha(color, 0.12)}` : "";
  return {
    backgroundColor: tint,
    // A group's own hue is legible on a dark ground but too pale on a light one,
    // so the theme decides how far it gets pulled toward the text colour.
    color: `color-mix(in srgb, ${color} var(--hue-ink-mix), var(--hue-ink-base))`,
    boxShadow: `inset 0 1px 0 var(--sheen-line), inset 0 0 0 1px ${ring}${halo}, 0 1px 3px var(--chip-drop)`,
  };
}

// A tag pill in a filter list: faint wash of its own colour, ring and text
// turning up when it is the active filter.
export function tagPillStyle(color: string | null, selected: boolean): CSSProperties | undefined {
  if (!color) return undefined;
  return {
    backgroundColor: hexAlpha(color, selected ? 0.32 : 0.16) ?? undefined,
    borderColor: hexAlpha(color, selected ? 0.75 : 0.4) ?? undefined,
    color: `color-mix(in srgb, ${color} var(--hue-ink-mix), var(--hue-ink-base))`,
  };
}

export const tagPillClass = "px-3 py-1 rounded-full text-xs border backdrop-blur-md transition";

export function tagPillFallback(selected: boolean) {
  return selected
    ? "bg-lift-3 border-line-strong text-neutral-100"
    : "bg-lift border-line text-neutral-400 hover:bg-lift-2";
}
