import { contrastText } from "@/lib/color";

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
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium ${className}`}
      style={
        group.color
          ? { backgroundColor: group.color, color: contrastText(group.color) }
          : { backgroundColor: "#3f3f46", color: "#e5e5e5" }
      }
    >
      <FolderIcon />
      {group.name}
    </span>
  );
}
