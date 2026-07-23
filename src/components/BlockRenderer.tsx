"use client";

import type { Block } from "@/lib/types";
import { YouTubePlayer, UploadedVideo } from "./VideoPlayer";
import { contrastText } from "@/lib/color";

function MediaTagList({
  tags,
  colors,
}: {
  tags?: string[];
  colors?: Map<string, string | null>;
}) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {tags.map((t) => {
        const color = colors?.get(t) ?? null;
        return (
          <span
            key={t}
            className={`text-xs px-2 py-0.5 rounded-full ${color ? "" : "text-neutral-500 bg-neutral-800"}`}
            style={color ? { backgroundColor: color, color: contrastText(color) } : undefined}
          >
            #{t}
          </span>
        );
      })}
    </div>
  );
}

export default function BlockRenderer({
  blocks,
  tagColors,
}: {
  blocks: Block[];
  tagColors?: Map<string, string | null>;
}) {
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "text":
            return (
              <div key={i}>
                {block.content.split("\n").map((line, j) => (
                  <p key={j} className="mb-2 text-neutral-300 leading-relaxed">
                    {line || " "}
                  </p>
                ))}
              </div>
            );
          case "image":
            return (
              <div key={i}>
                <div className="rounded-xl overflow-hidden">
                  <img src={block.url} alt="" className="w-full" />
                </div>
                <MediaTagList tags={block.tags} colors={tagColors} />
              </div>
            );
          case "video":
            return (
              <div key={i}>
                <UploadedVideo url={block.url} />
                <MediaTagList tags={block.tags} colors={tagColors} />
              </div>
            );
          case "youtube":
            return (
              <div key={i}>
                <YouTubePlayer
                  url={block.url}
                  startTime={block.startTime}
                  endTime={block.endTime}
                />
                <MediaTagList tags={block.tags} colors={tagColors} />
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
