"use client";

import { useRef, useState } from "react";
import type { CarouselItem } from "@/lib/types";
import { UploadedVideo } from "./VideoPlayer";

// "Stacked squares" glyph — signals at a glance that a slide has several items.
function StackIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M4 16V6a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

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

          <div className="absolute top-2.5 right-2.5 z-20 inline-flex items-center gap-1 text-sm font-bold bg-black/70 text-white pl-1.5 pr-2.5 py-1 rounded-full pointer-events-none shadow-lg ring-1 ring-white/25">
            <span className="text-sky-300"><StackIcon /></span>
            <span className="tabular-nums">{index + 1} / {items.length}</span>
          </div>

          <div className="flex justify-center gap-1.5 mt-2.5">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to item ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-6 bg-sky-400" : "w-2 bg-white/35 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
