"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useBoardFilter } from "./BoardFilterContext";
import ThemeToggle from "./ThemeToggle";
import { FolderIcon } from "./GroupBadge";
import {
  groupChipClass,
  groupChipStyle,
  tagPillClass,
  tagPillFallback,
  tagPillStyle,
} from "@/lib/chipStyles";

interface Group {
  id: string;
  name: string;
  color: string | null;
  count: number;
}

interface Tag {
  name: string;
  count: number;
  color: string | null;
  tagGroupId?: string | null;
  tagGroupName?: string | null;
}

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="block">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const TeamIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="block shrink-0">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
  </svg>
);

const LogOutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="block shrink-0">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </svg>
);

/**
 * The board's menu: everything that narrows the list (groups, tags) plus the
 * account-level settings, in a sheet that slides in from the right.
 *
 * The filters used to sit on the board itself — group tabs above the posts and a
 * tag list below them — which stopped scaling once a team had more than a
 * handful of tags. Here the list can grow without pushing the posts down the
 * page, and what is currently selected still shows above the board.
 */
export default function FilterDrawer({
  open,
  onClose,
  teamId,
  teams,
  onTeamChange,
  user,
}: {
  open: boolean;
  onClose: () => void;
  teamId: string | null;
  teams: { id: string; name: string }[];
  onTeamChange: (id: string) => void;
  user?: { name?: string | null; email?: string | null };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    activeGroupId,
    setActiveGroupId,
    activeTags,
    toggleTag,
    setActiveTags,
    matchMode,
    setMatchMode,
  } = useBoardFilter();

  const [groups, setGroups] = useState<Group[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    if (!teamId) return;
    fetch(`/api/groups?teamId=${teamId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((g) => setGroups(Array.isArray(g) ? g : []))
      .catch(() => setGroups([]));
    fetch(`/api/tags?teamId=${teamId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((t) => setTags(Array.isArray(t) ? t : []))
      .catch(() => setTags([]));
  }, [teamId, pathname]);

  // Escape closes, and the page behind must not scroll while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Filtering only means anything on the board, so picking one from another page
  // takes you there — and the sheet gets out of the way so the results are
  // visible. On the board itself it stays open, for picking several tags.
  function goToBoard() {
    if (pathname !== "/") {
      onClose();
      router.push("/");
    }
  }

  // Tags listed under their group so the list stays readable as it grows;
  // ungrouped ones last, and unlabelled when they're the only ones.
  const tagSections = (() => {
    const byGroup = new Map<string, { key: string; title: string | null; items: Tag[] }>();
    const ungrouped: Tag[] = [];
    for (const tag of tags) {
      if (!tag.tagGroupId) {
        ungrouped.push(tag);
        continue;
      }
      const section = byGroup.get(tag.tagGroupId) ?? {
        key: tag.tagGroupId,
        title: tag.tagGroupName ?? null,
        items: [],
      };
      section.items.push(tag);
      byGroup.set(tag.tagGroupId, section);
    }
    const grouped = [...byGroup.values()];
    if (ungrouped.length > 0) {
      grouped.push({
        key: "__ungrouped__",
        title: grouped.length > 0 ? "未分類" : null,
        items: ungrouped,
      });
    }
    return grouped;
  })();

  return (
    <>
      {/* Scrim. Kept mounted so the sheet can animate back out. */}
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="メニュー"
        aria-hidden={!open}
        className={`glass-strong fixed right-0 top-0 z-[61] h-full w-[19rem] max-w-[85vw] overflow-y-auto overscroll-contain border-l border-line shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
        }}
      >
        <div className="px-4 py-3.5 flex items-center justify-between">
          <span className="text-sm font-bold text-neutral-100">メニュー</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-lift-2 transition"
          >
            <CloseIcon />
          </button>
        </div>

        {groups.length > 0 && (
          <section className="px-4 pb-4">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2">
              グループ
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setActiveGroupId(null);
                  goToBoard();
                }}
                style={groupChipStyle(null, activeGroupId === null)}
                className={groupChipClass}
              >
                すべて
              </button>
              {groups.map((g) => {
                const active = activeGroupId === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      setActiveGroupId(active ? null : g.id);
                      goToBoard();
                    }}
                    style={groupChipStyle(g.color, active)}
                    className={`${groupChipClass} inline-flex items-center gap-1.5`}
                  >
                    <FolderIcon />
                    {g.name} ({g.count})
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {tags.length > 0 && (
          <section className="px-4 pb-4 border-t border-line pt-4">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2">
              タグ
            </h2>

            <div className="mb-3">
              <button
                onClick={() => {
                  setActiveTags([]);
                  goToBoard();
                }}
                className={`${tagPillClass} ${tagPillFallback(activeTags.length === 0)}`}
              >
                すべて
              </button>
            </div>

            <div className="space-y-3">
              {tagSections.map((section) => (
                <div key={section.key}>
                  {section.title && (
                    <h3 className="text-[11px] font-semibold text-neutral-500 mb-1.5">
                      {section.title}
                    </h3>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {section.items.map((tag) => {
                      const selected = activeTags.includes(tag.name);
                      return (
                        <button
                          key={tag.name}
                          onClick={() => {
                            toggleTag(tag.name);
                            goToBoard();
                          }}
                          aria-pressed={selected}
                          style={tagPillStyle(tag.color, selected)}
                          className={`${tagPillClass} ${tag.color ? "" : tagPillFallback(selected)}`}
                        >
                          {selected ? "✓ " : ""}#{tag.name} ({tag.count})
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {activeTags.length >= 2 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-neutral-400">
                <span>一致:</span>
                <div className="inline-flex rounded-lg border border-neutral-700 overflow-hidden">
                  <button
                    onClick={() => setMatchMode("and")}
                    className={`px-2.5 py-1 transition ${
                      matchMode === "and"
                        ? "bg-neutral-200 text-neutral-900"
                        : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                    }`}
                  >
                    すべて
                  </button>
                  <button
                    onClick={() => setMatchMode("or")}
                    className={`px-2.5 py-1 transition border-l border-neutral-700 ${
                      matchMode === "or"
                        ? "bg-neutral-200 text-neutral-900"
                        : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                    }`}
                  >
                    いずれか
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="px-4 py-4 border-t border-line">
          <ThemeToggle />
        </section>

        {teams.length > 1 && teamId && (
          <section className="px-4 py-4 border-t border-line">
            <div className="text-xs text-neutral-500 mb-1.5">チーム</div>
            <select
              value={teamId}
              onChange={(e) => onTeamChange(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 px-2 py-1.5 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </section>
        )}

        <section className="border-t border-line py-2">
          <Link
            href="/team"
            onClick={onClose}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-300 hover:bg-lift-2 transition"
          >
            <TeamIcon />
            チーム設定
          </Link>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-300 hover:bg-lift-2 transition"
          >
            <LogOutIcon />
            ログアウト
          </button>
          {user && (
            <div className="px-4 pt-2 pb-1">
              <div className="text-xs text-neutral-400 truncate">{user.name}</div>
              {user.email && (
                <div className="text-[11px] text-neutral-600 truncate">{user.email}</div>
              )}
            </div>
          )}
        </section>
      </aside>
    </>
  );
}
