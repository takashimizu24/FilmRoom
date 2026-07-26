"use client";

import { useState } from "react";
import { useComments } from "./CommentsContext";
import CommentSection from "./CommentSection";
import TagList from "./TagList";

function CommentIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

// A block's footer: its hashtags on the left and a small comment toggle at the
// right edge, on ONE row, so the comment affordance doesn't add a separate line
// that pushes a following "caption" text block away from its media. The thread
// itself is collapsed by default and expands below the row.
//
// `enabledByDefault` decides whether the comment toggle shows for logged-in users
// with no comments yet: true for media (you comment on the clip), false for text
// blocks (they're usually captions and don't need their own thread) — but an
// existing comment always keeps the toggle so nothing gets orphaned.
export default function BlockComments({
  blockRef,
  tags,
  tagColors,
  enabledByDefault = true,
}: {
  blockRef: number;
  tags?: string[];
  tagColors?: Map<string, string | null>;
  enabledByDefault?: boolean;
}) {
  const { countFor, session } = useComments();
  const [open, setOpen] = useState(false);
  const count = countFor(blockRef);

  const hasTags = !!tags && tags.length > 0;
  const showToggle = count > 0 || (enabledByDefault && !!session);

  if (!hasTags && !showToggle) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {hasTags && (
            <TagList
              tags={tags!.map((t) => ({ name: t, color: tagColors?.get(t) ?? null }))}
              max={3}
            />
          )}
        </div>
        {showToggle && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={count > 0 ? `${count} comments` : "Add a comment"}
            title={count > 0 ? `${count} comment${count === 1 ? "" : "s"}` : "Add a comment"}
            className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition ${
              open || count > 0
                ? "text-neutral-300 hover:text-neutral-100"
                : "text-neutral-600 hover:text-neutral-300"
            }`}
          >
            <CommentIcon />
            {count > 0 && <span className="tabular-nums">{count}</span>}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 pl-1 border-l-2 border-neutral-800">
          <div className="pl-3">
            <CommentSection
              blockRef={blockRef}
              emptyText="No comments on this item yet."
              placeholder="Comment on this item..."
              autoFocusComposer
            />
          </div>
        </div>
      )}
    </div>
  );
}
