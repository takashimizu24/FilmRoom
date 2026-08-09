"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { notifSeenKey, markNotificationsSeen } from "@/components/notifications";

interface ActivityItem {
  kind: "post" | "comment";
  id: string;
  postId: string;
  postTitle: string;
  actorId: string;
  actorName: string;
  createdAt: string;
  media: "video" | "image" | null;
  snippet: string | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}日前`;
  return new Date(iso).toLocaleDateString("ja-JP");
}

function itemLabel(it: ActivityItem): string {
  if (it.kind === "comment") return `${it.actorName}さんがコメントしました`;
  if (it.media === "video") return `${it.actorName}さんが動画を投稿しました`;
  if (it.media === "image") return `${it.actorName}さんが画像を投稿しました`;
  return `${it.actorName}さんが投稿を追加しました`;
}

function Glyph({ it }: { it: ActivityItem }) {
  const base = "shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm";
  if (it.kind === "comment")
    return <div className={`${base} bg-sky-500/15 text-sky-300`}>💬</div>;
  if (it.media === "video")
    return <div className={`${base} bg-emerald-500/15 text-emerald-300`}>🎬</div>;
  if (it.media === "image")
    return <div className={`${base} bg-violet-500/15 text-violet-300`}>🖼</div>;
  return <div className={`${base} bg-lift-2 text-neutral-300`}>📝</div>;
}

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSeen, setLastSeen] = useState<number>(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    async function load() {
      const teams = await fetch("/api/teams").then((r) => r.json());
      if (!teams.length) {
        setLoading(false);
        return;
      }
      const activeId = document.cookie.match(/activeTeamId=([^;]+)/)?.[1];
      const teamId = teams.some((t: { id: string }) => t.id === activeId) ? activeId : teams[0].id;

      // Read the previous "seen" time before we overwrite it, so we can flag
      // which items are new since the last visit.
      const prev = Number(localStorage.getItem(notifSeenKey(teamId)) ?? 0);
      setLastSeen(prev);

      const data = await fetch(`/api/activity?teamId=${teamId}`).then((r) => (r.ok ? r.json() : []));
      setItems(Array.isArray(data) ? data : []);
      setLoading(false);

      // Opening the screen marks everything up to now as seen (clears the badge).
      markNotificationsSeen(teamId);
    }
    load();
  }, [status]);

  if (status === "loading" || (status === "authenticated" && loading)) {
    return <div className="max-w-2xl mx-auto px-4 py-12 text-center text-neutral-500">Loading...</div>;
  }
  if (status === "unauthenticated") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-neutral-500">
        <Link href="/login" className="text-neutral-300 hover:text-neutral-100 transition">ログイン</Link>してください。
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-neutral-100 mb-6">お知らせ</h1>

      {items.length === 0 ? (
        <div className="text-center py-16 text-neutral-500 text-sm">
          まだお知らせはありません。<br />動画やコメントが追加されると、ここに表示されます。
        </div>
      ) : (
        <ul className="glass rounded-xl divide-y divide-line overflow-hidden">
          {items.map((it) => {
            const isNew = new Date(it.createdAt).getTime() > lastSeen && it.actorId !== session?.user?.id;
            return (
              <li key={`${it.kind}-${it.id}`}>
                <Link
                  href={`/posts/${it.postId}`}
                  className={`flex items-start gap-3 px-4 py-3 transition hover:bg-lift ${isNew ? "bg-sky-500/5" : ""}`}
                >
                  <Glyph it={it} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <span className="text-sm text-neutral-200">{itemLabel(it)}</span>
                      {isNew && <span className="shrink-0 w-2 h-2 rounded-full bg-sky-400 mt-1.5" aria-label="新着" />}
                    </div>
                    <div className="text-xs text-neutral-400 truncate mt-0.5">{it.postTitle}</div>
                    {it.snippet && (
                      <div className="text-xs text-neutral-500 truncate mt-0.5">「{it.snippet}」</div>
                    )}
                  </div>
                  <time className="shrink-0 text-[11px] text-neutral-600 mt-0.5">{timeAgo(it.createdAt)}</time>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
