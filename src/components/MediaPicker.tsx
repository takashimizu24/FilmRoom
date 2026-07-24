"use client";

import { extractYoutubeId } from "./VideoPlayer";

export type MediaItem = {
  type: "video" | "image" | "youtube";
  url: string;
  postTitle: string;
};

// A modal that lists media already used on the team so it can be reused in the
// current post. Picking an item inserts a block that points at the SAME url, so
// uploaded files aren't duplicated in storage and YouTube links aren't retyped.
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
        className="w-full max-w-2xl max-h-[80vh] flex flex-col bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden"
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
          <div className="overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items.map((item) => {
              const ytId = item.type === "youtube" ? extractYoutubeId(item.url) : null;
              return (
                <button
                  key={`${item.type}|${item.url}`}
                  type="button"
                  onClick={() => onPick(item)}
                  className="group text-left bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden hover:border-neutral-500 transition"
                >
                  <div className="relative aspect-video bg-black flex items-center justify-center">
                    {item.type === "image" && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.url} alt="" className="w-full h-full object-cover" />
                    )}
                    {item.type === "video" && (
                      <video src={item.url} preload="metadata" muted className="w-full h-full object-cover" />
                    )}
                    {item.type === "youtube" && ytId && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                    <span className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/70 text-neutral-200">
                      {item.type === "youtube" ? "YouTube" : item.type === "video" ? "Video" : "Image"}
                    </span>
                  </div>
                  <div className="px-2 py-1.5 text-xs text-neutral-400 truncate">{item.postTitle}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
