"use client";

import { useState } from "react";
import { useComments } from "./CommentsContext";
import CommentSection from "./CommentSection";

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

// Inline, collapsed-by-default comment thread for a single block. Kept hidden so
// the post's timeline of items doesn't grow too tall; the toggle shows the count.
export default function BlockComments({ blockRef }: { blockRef: number }) {
  const { countFor, session } = useComments();
  const [open, setOpen] = useState(false);
  const count = countFor(blockRef);

  // Logged-out viewers can't post; hide the affordance entirely when empty.
  if (!session && count === 0) return null;

  return (
    <div className="mt-1.5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={count > 0 ? `${count} comments` : "Add a comment"}
          title={count > 0 ? `${count} comment${count === 1 ? "" : "s"}` : "Add a comment"}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition ${
            open || count > 0
              ? "text-neutral-300 hover:text-neutral-100"
              : "text-neutral-600 hover:text-neutral-300"
          }`}
        >
          <CommentIcon />
          {count > 0 && <span className="tabular-nums">{count}</span>}
        </button>
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
