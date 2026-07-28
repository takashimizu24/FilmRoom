"use client";

import { useState, useRef } from "react";
import type { Block } from "@/lib/types";
import TagAutocomplete from "./TagAutocomplete";
import MediaPicker, { type MediaItem } from "./MediaPicker";

type TagSuggestion = { name: string; color?: string | null };

function TimeInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const hours = Math.floor(value / 3600);
  const min = Math.floor((value % 3600) / 60);
  const sec = value % 60;
  const set = (h: number, m: number, s: number) => onChange(Math.max(0, h * 3600 + m * 60 + s));
  const fieldClass =
    "w-16 px-2 py-1 border border-neutral-700 rounded text-sm text-neutral-100 bg-neutral-800";
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-neutral-500 w-10 shrink-0">{label}</span>
      <input
        type="number"
        min={0}
        value={hours}
        onChange={(e) => set(Number(e.target.value) || 0, min, sec)}
        className={fieldClass}
        placeholder="hr"
        aria-label={`${label} hours`}
      />
      <span className="text-xs text-neutral-600">:</span>
      <input
        type="number"
        min={0}
        max={59}
        value={min}
        onChange={(e) => set(hours, Number(e.target.value) || 0, sec)}
        className={fieldClass}
        placeholder="min"
        aria-label={`${label} minutes`}
      />
      <span className="text-xs text-neutral-600">:</span>
      <input
        type="number"
        min={0}
        max={59}
        value={sec}
        onChange={(e) => set(hours, min, Number(e.target.value) || 0)}
        className={fieldClass}
        placeholder="sec"
        aria-label={`${label} seconds`}
      />
    </div>
  );
}

function MediaTags({
  tags,
  onChange,
  suggestions,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions: TagSuggestion[];
}) {
  return (
    <div className="mt-2">
      <TagAutocomplete
        onAdd={(name) => {
          if (!tags.includes(name)) onChange([...tags, name]);
        }}
        suggestions={suggestions}
        existing={tags}
        placeholder="Add a tag..."
        size="sm"
        buttonLabel="Add Tag"
      />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 px-2 py-0.5 bg-neutral-800 rounded-full text-xs text-neutral-300"
            >
              #{tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                className="text-neutral-500 hover:text-neutral-300"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? m.toString().padStart(2, "0") : `${m}`;
  return h > 0
    ? `${h}:${mm}:${s.toString().padStart(2, "0")}`
    : `${mm}:${s.toString().padStart(2, "0")}`;
}

// Internal label for the media, hidden in the post but shown in the Reuse picker.
function CaptionInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Caption (only shown when reusing)"
      className="w-full mt-2 px-3 py-1.5 border border-neutral-700 rounded-lg text-xs text-neutral-100 bg-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
    />
  );
}

export default function BlockEditor({
  blocks,
  onChange,
  tagSuggestions = [],
  mediaLibrary = [],
}: {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  tagSuggestions?: TagSuggestion[];
  mediaLibrary?: MediaItem[];
}) {
  const [uploading, setUploading] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null); // "Uploading 2 of 5…"
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const carouselInputRef = useRef<HTMLInputElement>(null);
  const [carouselTarget, setCarouselTarget] = useState<number | null>(null);
  const [pendingInsertIndex, setPendingInsertIndex] = useState<number | null>(null);
  const [pendingInsertType, setPendingInsertType] = useState<"video" | "image" | null>(null);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Insert a block that reuses existing media (same url) — no re-upload. The
  // caption is carried over so the clip stays identifiable when reused again.
  function insertExistingMedia(item: MediaItem) {
    const caption = item.caption?.trim() || undefined;
    const block: Block =
      item.type === "video"
        ? { type: "video", url: item.url, tags: [], caption }
        : item.type === "image"
        ? { type: "image", url: item.url, tags: [], caption }
        : { type: "youtube", url: item.url, startTime: 0, endTime: 0, tags: [], caption };
    onChange([...blocks, block]);
    setPickerOpen(false);
  }

  function updateBlock(index: number, updated: Block) {
    const next = [...blocks];
    next[index] = updated;
    onChange(next);
  }

  function removeBlock(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  function moveBlock(index: number, dir: -1 | 1) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    onChange(next);
  }

  // Jump a block straight to the top, keeping the order of the rest.
  function moveBlockToTop(index: number) {
    if (index <= 0) return;
    const next = [...blocks];
    const [moved] = next.splice(index, 1);
    next.unshift(moved);
    onChange(next);
  }

  function addBlock(type: Block["type"], atIndex?: number) {
    const insertAt = atIndex ?? blocks.length;
    let newBlock: Block;
    switch (type) {
      case "text":
        newBlock = { type: "text", content: "" };
        break;
      case "image":
        setPendingInsertIndex(insertAt);
        setPendingInsertType("image");
        imageInputRef.current?.click();
        return;
      case "video":
        setPendingInsertIndex(insertAt);
        setPendingInsertType("video");
        fileInputRef.current?.click();
        return;
      case "youtube":
        newBlock = { type: "youtube", url: "", startTime: 0, endTime: 0, tags: [] };
        break;
      default:
        return;
    }
    const next = [...blocks];
    next.splice(insertAt, 0, newBlock);
    onChange(next);
  }

  // Shared upload helper: converts HEIC, enforces the size cap, and posts the
  // file. Returns the stored URL, or null if it was rejected/failed (an alert is
  // shown in that case).
  async function uploadFile(input: File): Promise<string | null> {
    let file = input;

    // HEIC → JPEG conversion
    if (file.name.toLowerCase().endsWith(".heic") || file.type === "image/heic") {
      try {
        const heic2any = (await import("heic2any")).default;
        const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
        const converted = Array.isArray(blob) ? blob[0] : blob;
        file = new File([converted], file.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" });
      } catch {
        // If conversion fails, try uploading as-is
      }
    }

    const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500MB — trim longer footage into shorter clips
    if (file.size > MAX_UPLOAD_BYTES) {
      alert(
        "This file is too large (over 500MB). Please trim it into shorter clips before uploading."
      );
      return null;
    }

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "x-filename": encodeURIComponent(file.name),
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });
      if (res.ok) {
        const { url } = await res.json();
        return url as string;
      }
      const { error } = await res.json().catch(() => ({ error: null }));
      alert(error || "Upload failed. Please check your connection and try again.");
      return null;
    } catch {
      alert("Upload failed. Please check your connection and try again.");
      return null;
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || pendingInsertIndex === null || !pendingInsertType) {
      e.target.value = "";
      return;
    }

    const type = pendingInsertType;
    const insertAt = pendingInsertIndex;

    // Upload the picked files one at a time (safer for the server than many big
    // uploads at once), collecting the stored urls in order.
    const uploaded: { type: "video" | "image"; url: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      setUploading(insertAt);
      setUploadProgress(files.length > 1 ? `Uploading ${i + 1} of ${files.length}…` : null);
      const url = await uploadFile(files[i]);
      if (url) uploaded.push({ type, url });
    }

    if (uploaded.length > 0) {
      // One file → a single media block (unchanged). Several → a swipeable
      // carousel that keeps them in one vertical slot.
      const newBlock: Block =
        uploaded.length === 1
          ? { type, url: uploaded[0].url, tags: [] }
          : { type: "carousel", items: uploaded, tags: [] };
      const next = [...blocks];
      next.splice(insertAt, 0, newBlock);
      onChange(next);
    }

    setUploading(null);
    setUploadProgress(null);
    setPendingInsertIndex(null);
    setPendingInsertType(null);
    e.target.value = "";
  }

  // ----- carousel editing -----
  function removeCarouselItem(bi: number, ii: number) {
    const b = blocks[bi];
    if (b.type !== "carousel") return;
    const items = b.items.filter((_, k) => k !== ii);
    if (items.length === 0) removeBlock(bi);
    else if (items.length === 1) updateBlock(bi, { type: items[0].type, url: items[0].url, tags: b.tags ?? [], caption: b.caption });
    else updateBlock(bi, { ...b, items });
  }

  function moveCarouselItem(bi: number, ii: number, dir: -1 | 1) {
    const b = blocks[bi];
    if (b.type !== "carousel") return;
    const j = ii + dir;
    if (j < 0 || j >= b.items.length) return;
    const items = [...b.items];
    [items[ii], items[j]] = [items[j], items[ii]];
    updateBlock(bi, { ...b, items });
  }

  function handleCarouselAddClick(index: number) {
    const b = blocks[index];
    if (b.type !== "carousel") return;
    setCarouselTarget(index);
    const t = b.items[0]?.type ?? "video";
    if (carouselInputRef.current) {
      carouselInputRef.current.accept = t === "video" ? "video/*" : "image/*,.heic,.HEIC";
    }
    carouselInputRef.current?.click();
  }

  async function handleCarouselAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const index = carouselTarget;
    if (!files.length || index === null || blocks[index]?.type !== "carousel") {
      setCarouselTarget(null);
      e.target.value = "";
      return;
    }
    const base = blocks[index];
    if (base.type !== "carousel") return;
    const t = base.items[0]?.type ?? "video";
    setUploading(index);
    let items = [...base.items];
    for (let k = 0; k < files.length; k++) {
      setUploadProgress(files.length > 1 ? `Uploading ${k + 1} of ${files.length}…` : null);
      const url = await uploadFile(files[k]);
      if (url) {
        items = [...items, { type: t, url }];
        updateBlock(index, { ...base, items });
      }
    }
    setUploading(null);
    setUploadProgress(null);
    setCarouselTarget(null);
    e.target.value = "";
  }

  // Swap the file behind an existing video/image block. The old file is deleted
  // from storage when the post is saved (see the post PATCH handler), so space
  // is reclaimed without breaking the post if the edit is cancelled.
  function handleReplaceClick(index: number) {
    const block = blocks[index];
    if (block.type !== "video" && block.type !== "image") return;
    setReplacingIndex(index);
    if (replaceInputRef.current) {
      replaceInputRef.current.accept =
        block.type === "video" ? "video/*" : "image/*,.heic,.HEIC";
    }
    replaceInputRef.current?.click();
  }

  async function handleReplaceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const index = replacingIndex;
    if (!file || index === null) {
      setReplacingIndex(null);
      e.target.value = "";
      return;
    }

    setUploading(index);
    const url = await uploadFile(file);
    if (url) {
      const block = blocks[index];
      if (block.type === "video" || block.type === "image") {
        updateBlock(index, { ...block, url });
      }
    }

    setUploading(null);
    setReplacingIndex(null);
    e.target.value = "";
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*,.heic,.HEIC"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />
      <input
        ref={replaceInputRef}
        type="file"
        className="hidden"
        onChange={handleReplaceFile}
      />
      <input
        ref={carouselInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleCarouselAdd}
      />

      {blocks.map((block, i) => (
        <div key={i} className="group relative bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          {/* Block controls */}
          <div className="absolute -left-10 top-1/2 -translate-y-1/2 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => moveBlockToTop(i)}
              disabled={i === 0}
              className="w-7 h-7 bg-neutral-800 hover:bg-neutral-700 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-200 transition disabled:opacity-30 disabled:hover:bg-neutral-800"
              title="Move to top"
              aria-label="Move to top"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4h14" />
                <path d="m7 13 5-5 5 5" />
                <path d="m7 19 5-5 5 5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => moveBlock(i, -1)}
              disabled={i === 0}
              className="w-7 h-7 bg-neutral-800 hover:bg-neutral-700 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-200 transition disabled:opacity-30 disabled:hover:bg-neutral-800"
              title="Move up"
              aria-label="Move up"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 15 6-6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => moveBlock(i, 1)}
              disabled={i === blocks.length - 1}
              className="w-7 h-7 bg-neutral-800 hover:bg-neutral-700 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-200 transition disabled:opacity-30 disabled:hover:bg-neutral-800"
              title="Move down"
              aria-label="Move down"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            onClick={() => removeBlock(i)}
            className="absolute -right-2 -top-2 w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center bg-neutral-600 text-neutral-100 rounded-full text-sm shadow-md transition hover:bg-neutral-500"
            title="Delete"
          >×</button>

          {/* Block content */}
          {block.type === "text" && (
            <textarea
              value={block.content}
              onChange={(e) => updateBlock(i, { ...block, content: e.target.value })}
              placeholder="Enter text..."
              rows={3}
              className="w-full px-3 py-2 border border-neutral-700 rounded-lg text-sm text-neutral-100 bg-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-neutral-500 focus:border-transparent resize-y"
            />
          )}

          {block.type === "image" && (
            <div>
              <div className="text-xs text-neutral-500 mb-1 flex items-center justify-between">
                <span>Image</span>
                <button
                  type="button"
                  onClick={() => handleReplaceClick(i)}
                  disabled={uploading === i}
                  className="text-neutral-400 hover:text-neutral-200 transition disabled:opacity-50"
                >
                  {uploading === i ? "Replacing…" : "Replace"}
                </button>
              </div>
              <img src={block.url} alt="" className="max-h-64 rounded-lg" />
              <CaptionInput
                value={block.caption ?? ""}
                onChange={(v) => updateBlock(i, { ...block, caption: v })}
              />
              <MediaTags
                tags={block.tags ?? []}
                onChange={(tags) => updateBlock(i, { ...block, tags })}
                suggestions={tagSuggestions}
              />
            </div>
          )}

          {block.type === "video" && (
            <div>
              <div className="text-xs text-neutral-500 mb-1 flex items-center justify-between">
                <span>Video</span>
                <button
                  type="button"
                  onClick={() => handleReplaceClick(i)}
                  disabled={uploading === i}
                  className="text-neutral-400 hover:text-neutral-200 transition disabled:opacity-50"
                >
                  {uploading === i ? "Replacing…" : "Replace"}
                </button>
              </div>
              <video src={block.url} controls playsInline className="max-h-64 rounded-lg" />
              <CaptionInput
                value={block.caption ?? ""}
                onChange={(v) => updateBlock(i, { ...block, caption: v })}
              />
              <MediaTags
                tags={block.tags ?? []}
                onChange={(tags) => updateBlock(i, { ...block, tags })}
                suggestions={tagSuggestions}
              />
            </div>
          )}

          {block.type === "youtube" && (
            <div className="space-y-2">
              <div className="text-xs text-neutral-500">YouTube</div>
              <input
                type="url"
                value={block.url}
                onChange={(e) => updateBlock(i, { ...block, url: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3 py-2 border border-neutral-700 rounded-lg text-sm text-neutral-100 bg-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
              />
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-x-4">
                <TimeInput
                  label="Start"
                  value={block.startTime}
                  onChange={(v) => updateBlock(i, { ...block, startTime: v })}
                />
                <TimeInput
                  label="End"
                  value={block.endTime}
                  onChange={(v) => updateBlock(i, { ...block, endTime: v })}
                />
                {block.startTime > 0 || block.endTime > 0 ? (
                  <span className="text-xs text-neutral-400 self-center">
                    {formatTime(block.startTime)} – {block.endTime > 0 ? formatTime(block.endTime) : "end"}
                  </span>
                ) : null}
              </div>
              <CaptionInput
                value={block.caption ?? ""}
                onChange={(v) => updateBlock(i, { ...block, caption: v })}
              />
              <MediaTags
                tags={block.tags ?? []}
                onChange={(tags) => updateBlock(i, { ...block, tags })}
                suggestions={tagSuggestions}
              />
            </div>
          )}

          {block.type === "carousel" && (
            <div>
              <div className="text-xs text-neutral-500 mb-1.5">
                Carousel — {block.items.length} items (swipe horizontally in the post)
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {block.items.map((it, j) => (
                  <div key={j} className="relative shrink-0 w-40">
                    {it.type === "video" ? (
                      <video
                        src={`${it.url}#t=0.1`}
                        muted
                        playsInline
                        preload="metadata"
                        className="w-40 h-24 object-cover rounded-lg bg-black"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.url} alt="" className="w-40 h-24 object-cover rounded-lg" />
                    )}
                    <span className="absolute top-1 left-1 text-[10px] px-1 rounded bg-black/70 text-neutral-200">
                      {j + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCarouselItem(i, j)}
                      aria-label="Remove from carousel"
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center bg-neutral-600 hover:bg-neutral-500 text-neutral-100 rounded-full text-xs shadow"
                    >
                      ×
                    </button>
                    <div className="absolute bottom-1 inset-x-1 flex justify-between">
                      <button
                        type="button"
                        onClick={() => moveCarouselItem(i, j, -1)}
                        disabled={j === 0}
                        aria-label="Move left"
                        className="w-5 h-5 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded disabled:opacity-30"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={() => moveCarouselItem(i, j, 1)}
                        disabled={j === block.items.length - 1}
                        aria-label="Move right"
                        className="w-5 h-5 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded disabled:opacity-30"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => handleCarouselAddClick(i)}
                  disabled={uploading === i}
                  className="shrink-0 w-40 h-24 border-2 border-dashed border-neutral-700 hover:border-neutral-500 rounded-lg text-neutral-400 hover:text-neutral-200 flex items-center justify-center text-sm transition disabled:opacity-50"
                >
                  {uploading === i ? "Uploading…" : "+ Add"}
                </button>
              </div>
              <CaptionInput
                value={block.caption ?? ""}
                onChange={(v) => updateBlock(i, { ...block, caption: v })}
              />
              <MediaTags
                tags={block.tags ?? []}
                onChange={(tags) => updateBlock(i, { ...block, tags })}
                suggestions={tagSuggestions}
              />
            </div>
          )}
        </div>
      ))}

      {uploading !== null && (
        <div className="text-center py-3 text-sm text-neutral-500">
          {uploadProgress ?? "Uploading..."}
        </div>
      )}

      {/* Add block buttons */}
      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={() => addBlock("text")}
          className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-300 transition"
        >
          <span className="text-base">T</span> Text
        </button>
        <button
          type="button"
          onClick={() => addBlock("image")}
          className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-300 transition"
        >
          <span className="text-base">🖼</span> Image
        </button>
        <button
          type="button"
          onClick={() => addBlock("video")}
          className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-300 transition"
        >
          <span className="text-base">🎬</span> Video
        </button>
        <button
          type="button"
          onClick={() => addBlock("youtube")}
          className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-300 transition"
        >
          <span className="text-base">▶</span> YouTube
        </button>
        {mediaLibrary.length > 0 && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-300 transition"
          >
            <span className="text-base">♻</span> Reuse
          </button>
        )}
      </div>

      {pickerOpen && (
        <MediaPicker
          items={mediaLibrary}
          onPick={insertExistingMedia}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
