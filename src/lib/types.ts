export type Block =
  | { type: "text"; content: string }
  | { type: "image"; url: string; tags?: string[] }
  | { type: "video"; url: string; tags?: string[] }
  | { type: "youtube"; url: string; startTime: number; endTime: number; tags?: string[] };
