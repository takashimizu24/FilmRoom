// A single tag: "#name" rendered in a faint version of its assigned colour
// (grey when the tag has no colour). No dot, no filled background — a quiet
// hashtag that still hints at its colour.
export default function TagPill({ name, color }: { name: string; color?: string | null }) {
  return (
    <span
      className="text-xs"
      style={{
        // The tag's hue reads fine on a dark ground but is too pale on a light
        // one, so the theme decides how far it's pulled toward the text colour.
        color: color
          ? `color-mix(in srgb, ${color} var(--hue-ink-mix), var(--hue-ink-base))`
          : "var(--n-500)",
      }}
    >
      #{name}
    </span>
  );
}
