import { hexAlpha } from "@/lib/color";

export function FolderIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" />
    </svg>
  );
}

/**
 * A group is shown as a squared, folder-icon label so it reads clearly as a
 * category/container — visually distinct from the rounded "#tag" pills.
 */
export default function GroupBadge({
  group,
  className = "",
}: {
  group: { name: string; color: string | null };
  className?: string;
}) {
  return (
    // Squared (not a pill) so it still reads as a category rather than a #tag,
    // but finished like the glass panes around it: a light catching the top
    // edge, a colour ring drawn as an inset shadow instead of a flat border, and
    // a small drop shadow so the chip sits above the card.
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium backdrop-blur-md backdrop-saturate-150 whitespace-nowrap shrink-0 ${className}`}
      style={
        group.color
          ? {
              backgroundColor: hexAlpha(group.color, 0.22) ?? undefined,
              // Pulled toward the text colour on a light ground, left as-is on dark.
              color: `color-mix(in srgb, ${group.color} var(--hue-ink-mix), var(--hue-ink-base))`,
              boxShadow: `inset 0 1px 0 var(--sheen-line), inset 0 0 0 1px ${hexAlpha(
                group.color,
                0.45
              )}, 0 1px 3px var(--chip-drop)`,
            }
          : {
              backgroundColor: "var(--lift-2)",
              color: "var(--n-300)",
              boxShadow:
                "inset 0 1px 0 var(--sheen-line), inset 0 0 0 1px var(--line), 0 1px 3px var(--chip-drop)",
            }
      }
    >
      <FolderIcon />
      <span className="truncate max-w-[10rem]">{group.name}</span>
    </span>
  );
}
