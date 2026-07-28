"use client";

import { useRef, useState } from "react";
import type { CarouselItem } from "@/lib/types";
import { UploadedVideo } from "./VideoPlayer";

// A horizontal, swipeable gallery (Instagram-style). Native scroll-snap handles
// the swipe on touch; arrows + dots help on desktop. Each slide is a full-width
// uploaded video or image, so several clips share one vertical slot.
export default function MediaCarousel({ items }: { items: CarouselItem[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  if (!items || items.length === 0) return null;

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setIndex(Math.max(0, Math.min(items.length - 1, i)));
  }

  function go(i: number) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  const arrowClass =
    "hidden sm:flex absolute top-1/2 -translate-y-1/2 z-20 w-9 h-9 items-center justify-center rounded-full bg-black/55 hover:bg-black/75 text-white text-xl leading-none";

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((it, i) => (
          <div key={i} className="snap-center shrink-0 w-full">
            {it.type === "video" ? (
              <UploadedVideo url={it.url} />
            ) : (
              <div className="rounded-xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt="" className="w-full" />
              </div>
            )}
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <>
          {index > 0 && (
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous"
              className={`${arrowClass} left-2`}
            >
              ‹
            </button>
          )}
          {index < items.length - 1 && (
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next"
              className={`${arrowClass} right-2`}
            >
              ›
            </button>
          )}

          <div className="absolute top-2 right-2 z-20 text-xs bg-black/60 text-white px-2 py-0.5 rounded-full pointer-events-none">
            {index + 1} / {items.length}
          </div>

          <div className="flex justify-center gap-1.5 mt-2">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to item ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-4 bg-neutral-200" : "w-1.5 bg-neutral-600 hover:bg-neutral-400"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
