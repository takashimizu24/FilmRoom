// `caption` is an internal label for the media — hidden in the post view, shown
// only in the "Reuse" picker to tell similar clips apart.
export type Block =
  | { type: "text"; content: string }
  | { type: "image"; url: string; tags?: string[]; caption?: string }
  | { type: "video"; url: string; tags?: string[]; caption?: string }
  | { type: "youtube"; url: string; startTime: number; endTime: number; tags?: string[]; caption?: string };
