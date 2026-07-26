"use client";

import { useState } from "react";
import type { Block } from "@/lib/types";
import { YouTubePlayer, UploadedVideo } from "./VideoPlayer";
import TagList from "./TagList";
import BlockComments from "./BlockComments";
import { blockAnchorId } from "@/lib/blocks";

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
    <div className="mt-2">
      <TagList tags={tags.map((t) => ({ name: t, color: colors?.get(t) ?? null }))} max={3} />
    </div>
  );
}

export default function BlockRenderer({
  blocks,
  tagColors,
  withComments = false,
}: {
  blocks: Block[];
  tagColors?: Map<string, string | null>;
  // When true, each block gets its own collapsible inline comment thread.
  // Requires the tree to be wrapped in <CommentsProvider>.
  withComments?: boolean;
}) {
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        let media: React.ReactNode = null;
        switch (block.type) {
          case "text":
            media = <TextBlock content={block.content} />;
            break;
          case "image":
            media = (
              <div className="rounded-xl overflow-hidden">
                <img src={block.url} alt="" className="w-full" />
              </div>
            );
            break;
          case "video":
            media = <UploadedVideo url={block.url} />;
            break;
          case "youtube":
            media = (
              <YouTubePlayer url={block.url} startTime={block.startTime} endTime={block.endTime} />
            );
            break;
          default:
            return null;
        }
        // Tags live only on media blocks. The footer keeps the tags and the
        // comment toggle on one row; text blocks (used as captions) get no
        // comment toggle by default so they sit tight under their media.
        const tags = "tags" in block ? block.tags : undefined;
        const isText = block.type === "text";
        return (
          <div key={i} id={blockAnchorId(i)} className="scroll-mt-20 target:ring-2 target:ring-neutral-500 rounded-xl">
            {media}
            {withComments ? (
              <BlockComments
                blockRef={i}
                tags={tags}
                tagColors={tagColors}
                enabledByDefault={!isText}
              />
            ) : (
              tags && tags.length > 0 ? <MediaTagList tags={tags} colors={tagColors} /> : null
            )}
          </div>
        );
      })}
    </div>
  );
}
