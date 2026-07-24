// A single tag: "#name" rendered in a faint version of its assigned colour
// (grey when the tag has no colour). No dot, no filled background — a quiet
// hashtag that still hints at its colour.
export default function TagPill({ name, color }: { name: string; color?: string | null }) {
  return (
    <span className="text-xs" style={{ color: color || "#737373" }}>
      #{name}
    </span>
  );
}
