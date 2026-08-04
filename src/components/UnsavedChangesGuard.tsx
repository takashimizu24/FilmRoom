"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Pending = { type: "href"; href: string } | { type: "back" } | null;

/**
 * Prompts "save your changes?" when the user tries to leave a form with unsaved
 * edits — instead of forcing them to scroll down to the Save button.
 *
 * Covers three exit routes:
 *  - in-app link clicks (header home/logo, bottom nav, etc.) — a custom modal
 *  - the browser/phone back button — via a history trap + popstate
 *  - reload / tab close / leaving the site — the native beforeunload prompt
 *
 * Anchors marked `data-allow-unsaved` (e.g. an explicit Cancel/Discard link) are
 * ignored so they leave immediately.
 */
export default function UnsavedChangesGuard({
  dirty,
  onSave,
}: {
  dirty: boolean;
  onSave: () => Promise<boolean>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const bypassRef = useRef(false);

  // Reload / close / cross-document navigation → native prompt.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Intercept in-app link clicks while there are unsaved changes.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement)?.closest?.("a");
      if (!a || a.hasAttribute("data-allow-unsaved")) return;
      const href = a.getAttribute("href");
      if (!href || a.target === "_blank") return;
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return; // external — let beforeunload handle it
      if (url.pathname === location.pathname && url.search === location.search) return; // same page
      e.preventDefault();
      e.stopPropagation();
      setPending({ type: "href", href: url.pathname + url.search });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Browser / phone back button. Arm a same-URL history entry while dirty; when
  // the user backs into it, prompt instead of leaving.
  useEffect(() => {
    if (!dirty) return;
    history.pushState(null, "", location.href);
    const onPop = () => {
      if (bypassRef.current) {
        bypassRef.current = false;
        return; // an intentional leave — let it through
      }
      if (!dirtyRef.current) return;
      setPending({ type: "back" });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [dirty]);

  const leave = useCallback(
    (p: Exclude<Pending, null>) => {
      if (p.type === "href") {
        router.push(p.href);
      } else {
        bypassRef.current = true;
        history.back();
      }
    },
    [router]
  );

  const handleDiscard = () => {
    const p = pending;
    setPending(null);
    if (p) leave(p);
  };

  const handleCancel = () => {
    const p = pending;
    setPending(null);
    // For a back-button prompt we already popped the trap entry; re-arm it so a
    // second back press is caught too.
    if (p?.type === "back" && dirtyRef.current) history.pushState(null, "", location.href);
  };

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave();
    setSaving(false);
    if (ok) {
      const p = pending;
      setPending(null);
      if (p) leave(p);
    } else {
      // Save failed (e.g. validation) — close the modal so the error is visible.
      handleCancel();
    }
  };

  if (!pending) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
      onClick={() => !saving && handleCancel()}
    >
      <div className="glass-strong rounded-2xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-neutral-100 mb-1">変更が保存されていません</h2>
        <p className="text-sm text-neutral-400 mb-4">この編集内容を保存しますか？</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium transition disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存する"}
          </button>
          <button
            onClick={handleDiscard}
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm transition disabled:opacity-50"
          >
            保存せずに移動
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="w-full py-2 text-neutral-400 hover:text-neutral-200 text-sm transition disabled:opacity-50"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
