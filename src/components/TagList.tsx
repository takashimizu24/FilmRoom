"use client";

import { useState } from "react";
import TagPill from "./TagPill";

type Tag = { name: string; color?: string | null };

// Renders a row of tags, but only the first `max`; the rest collapse behind a
// "+N" toggle. Keeps posts with many tags compact. The toggle stops click
// propagation so it works inside a card that is itself a link.
export default function TagList({
  tags,
  max = 3,
  className = "",
}: {
  tags: Tag[];
  max?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!tags || tags.length === 0) return null;

  const visible = expanded ? tags : tags.slice(0, max);
  const hidden = tags.length - visible.length;

  const toggle = (e: React.MouseEvent, next: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(next);
  };

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 ${className}`}>
      {visible.map((t) => (
        <TagPill key={t.name} name={t.name} color={t.color ?? null} />
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={(e) => toggle(e, true)}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition"
        >
          +{hidden}
        </button>
      )}
      {expanded && tags.length > max && (
        <button
          type="button"
          onClick={(e) => toggle(e, false)}
          className="text-xs text-neutral-600 hover:text-neutral-400 transition"
        >
          Hide
        </button>
      )}
    </span>
  );
}
