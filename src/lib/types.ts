// `caption` is an internal label for the media — hidden in the post view, shown
// only in the "Reuse" picker to tell similar clips apart.
export type CarouselItem = { type: "video" | "image"; url: string };

export type Block =
  | { type: "text"; content: string }
  | { type: "image"; url: string; tags?: string[]; caption?: string }
  | { type: "video"; url: string; tags?: string[]; caption?: string }
  | { type: "youtube"; url: string; startTime: number; endTime: number; tags?: string[]; caption?: string }
  // A horizontal, swipeable set of uploaded media (Instagram-style) that occupies
  // one vertical slot instead of stacking each clip.
  | { type: "carousel"; items: CarouselItem[]; tags?: string[]; caption?: string };
