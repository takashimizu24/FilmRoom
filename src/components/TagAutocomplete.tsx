"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = { name: string; color?: string | null };

// A tag input with an "Add" button and a predictive dropdown of tags already
// used on the team (excluding ones already added). Pressing Enter/comma or
// clicking Add adds the typed text; picking a suggestion adds that tag.
export default function TagAutocomplete({
  onAdd,
  suggestions,
  existing,
  placeholder,
  size = "md",
  buttonLabel = "Add",
}: {
  onAdd: (name: string) => void;
  suggestions: Suggestion[];
  existing: string[];
  placeholder?: string;
  size?: "md" | "sm";
  buttonLabel?: string;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const q = text.trim().toLowerCase();
  const existingSet = new Set(existing.map((t) => t.toLowerCase()));
  const filtered = suggestions
    .filter((s) => !existingSet.has(s.name.toLowerCase()) && (q === "" || s.name.toLowerCase().includes(q)))
    .slice(0, 8);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function add(name: string) {
    const v = name.trim();
    if (!v) return;
    onAdd(v);
    setText("");
    setActive(-1);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (open && active >= 0 && filtered[active]) add(filtered[active].name);
      else add(text);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filtered.length) {
        setOpen(true);
        setActive((a) => Math.min(a + 1, filtered.length - 1));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const inputCls =
    size === "sm"
      ? "flex-1 px-3 py-1.5 border border-neutral-700 rounded-lg text-xs text-neutral-100 bg-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
      : "flex-1 px-4 py-2 border border-neutral-700 rounded-lg text-neutral-100 bg-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-neutral-500 focus:border-transparent";
  const btnCls =
    size === "sm"
      ? "px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs text-neutral-300 transition border border-neutral-700"
      : "px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-300 transition";

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={inputCls}
        />
        <button type="button" onClick={() => add(text)} className={btnCls}>
          {buttonLabel}
        </button>
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-y-auto bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1 text-sm">
          {filtered.map((s, i) => (
            <li key={s.name}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(s.name)}
                onMouseEnter={() => setActive(i)}
                className={`w-full text-left px-3 py-1.5 transition ${i === active ? "bg-neutral-800" : "hover:bg-neutral-800"}`}
                style={{ color: s.color || "#d4d4d4" }}
              >
                #{s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
