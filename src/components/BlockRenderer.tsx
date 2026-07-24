"use client";

import { useState } from "react";
import type { Block } from "@/lib/types";
import { YouTubePlayer, UploadedVideo } from "./VideoPlayer";
import { contrastText } from "@/lib/color";

function TextBlock({ content }: { content: string }) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(false);

  async function handleTranslate() {
    if (translated) {
      setTranslated(null);
      return;
    }
    setTranslateError(false);
    setTranslating(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content }),
      });
      if (res.ok) {
        const { translated: result } = await res.json();
        setTranslated(result);
      } else {
        setTranslateError(true);
      }
    } catch {
      setTranslateError(true);
    }
    setTranslating(false);
  }

  return (
    <div>
      {content.split("\n").map((line, j) => (
        <p key={j} className="mb-2 text-neutral-300 leading-relaxed">
          {line || " "}
        </p>
      ))}
      {translated && (
        <p className="text-neutral-500 text-sm mb-2 italic leading-relaxed whitespace-pre-line">
          {translated}
        </p>
      )}
      {translateError && (
        <p className="text-red-400 text-xs mb-2">Translation failed. Try again.</p>
      )}
      <button
        type="button"
        onClick={handleTranslate}
        disabled={translating}
        className="text-xs text-neutral-500 hover:text-neutral-300 transition mb-2 disabled:opacity-50"
      >
        {translating ? "Translating..." : translated ? "Hide translation" : "Translate"}
      </button>
    </div>
  );
}

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
            return <TextBlock key={i} content={block.content} />;
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
