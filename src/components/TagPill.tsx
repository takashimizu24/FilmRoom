// A tag shown as a small coloured dot + muted label, so tags read as a quiet
// accent rather than a loud filled pill. The colour still identifies the tag.
export default function TagPill({ name, color }: { name: string; color?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
      <span
        className="w-[7px] h-[7px] rounded-full shrink-0"
        style={{ backgroundColor: color || "#525252" }}
        aria-hidden
      />
      {name}
    </span>
  );
}
