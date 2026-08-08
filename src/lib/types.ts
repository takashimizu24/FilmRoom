// `caption` is an internal label for the media — hidden in the post view, shown
// only in the "Reuse" picker to tell similar clips apart.
export type CarouselItem = { type: "video" | "image"; url: string };

// Blocks are grouped into Instagram-style sets (e.g. a clip plus the text that
// explains it) by marking where each set begins, rather than by nesting them.
// Keeping the array flat matters: comments point at a block by its index, so
// inserting group wrappers would re-target every existing comment.
export type BlockGrouping = {
  /** This block opens a new set. The blocks after it belong to the same set. */
  groupStart?: boolean;
  /** Optional heading for the set this block opens. */
  groupTitle?: string;
};

export type Block = BlockGrouping &
  (
    | { type: "text"; content: string }
    | { type: "image"; url: string; tags?: string[]; caption?: string }
    | { type: "video"; url: string; tags?: string[]; caption?: string }
    | { type: "youtube"; url: string; startTime: number; endTime: number; tags?: string[]; caption?: string }
    // A horizontal, swipeable set of uploaded media (Instagram-style) that occupies
    // one vertical slot instead of stacking each clip.
    | { type: "carousel"; items: CarouselItem[]; tags?: string[]; caption?: string }
  );
