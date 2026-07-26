"use client";

import { useState } from "react";
import { useComments } from "./CommentsContext";
import CommentSection from "./CommentSection";

// Inline, collapsed-by-default comment thread for a single block. Kept hidden so
// the post's timeline of items doesn't grow too tall; the toggle shows the count.
export default function BlockComments({ blockRef }: { blockRef: number }) {
  const { countFor, session } = useComments();
  const [open, setOpen] = useState(false);
  const count = countFor(blockRef);

  // Logged-out viewers can't post; hide the affordance entirely when empty.
  if (!session && count === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-full px-2.5 py-1 transition"
      >
        <span>💬</span>
        <span>
          {count > 0 ? `${count} comment${count === 1 ? "" : "s"}` : "Comment"}
        </span>
        <span className="text-neutral-600">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 pl-1 border-l-2 border-neutral-800">
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
