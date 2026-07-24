"use client";

import { extractYoutubeId } from "./VideoPlayer";

export type MediaItem = {
  type: "video" | "image" | "youtube";
  url: string;
  postTitle: string;
  caption?: string;
};

// A modal that lists media already used on the team so it can be reused in the
// current post. Uploaded videos are playable here so similar clips can be told
// apart; the media's caption (hidden in the post) is shown as its label.
// Picking an item inserts a block that points at the SAME url, so uploaded files
// aren't duplicated in storage and YouTube links aren't retyped.
export default function MediaPicker({
  items,
  onPick,
  onClose,
}: {
  items: MediaItem[];
  onPick: (item: MediaItem) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <h3 className="font-semibold text-neutral-200">Reuse existing media</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition"
          >
            ×
          </button>
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 text-sm">
            No media has been added to this team yet.
          </div>
        ) : (
          <div className="overflow-y-auto p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((item) => {
              const ytId = item.type === "youtube" ? extractYoutubeId(item.url) : null;
              const label = item.caption?.trim() || item.postTitle;
              const typeLabel =
                item.type === "youtube" ? "YouTube" : item.type === "video" ? "Video" : "Image";
              return (
                <div
                  key={`${item.type}|${item.url}`}
                  className="flex flex-col bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden"
                >
                  <div className="relative aspect-video bg-black flex items-center justify-center">
                    {item.type === "image" && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.url} alt="" className="w-full h-full object-contain" />
                    )}
                    {item.type === "video" && (
                      <video
                        src={item.url}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-contain"
                      />
                    )}
                    {item.type === "youtube" &&
                      (ytId ? (
                        <iframe
                          src={`https://www.youtube.com/embed/${ytId}`}
                          title={label}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <span className="text-neutral-500 text-xs">Invalid YouTube link</span>
                      ))}
                    <span className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/70 text-neutral-200 pointer-events-none">
                      {typeLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-2">
                    <span className="flex-1 min-w-0 text-xs text-neutral-300 truncate" title={label}>
                      {label || <span className="text-neutral-600">No caption</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => onPick(item)}
                      className="shrink-0 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-xs text-neutral-100 transition"
                    >
                      Use
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
