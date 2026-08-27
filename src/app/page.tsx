"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { posterUrlFor } from "@/lib/posters";
import { hexAlpha } from "@/lib/color";

interface Tile {
  id: string | null; // null = every video
  name: string;
  color: string | null;
  count: number;
  cover: string | null;
}

/**
 * The first screen: pick what you want to watch before you get a list.
 *
 * The timeline used to open straight away, which meant arriving at every clip
 * the team has ever posted, newest first, and scrolling for the ones you came
 * for. Choosing a group first turns that into one tap.
 *
 * Each tile is fronted by a still from that group's most recent clip, so the
 * choice is made on what the footage looks like rather than on a folder name.
 */
export default function GroupPickerPage() {
  const { status } = useSession();
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  // A cover is only a convention — the poster may not have been generated yet,
  // or the clip may predate posters entirely. A tile whose image fails falls
  // back to its colour rather than showing a broken picture.
  const [noCover, setNoCover] = useState<Set<string>>(new Set());
  const [teamName, setTeamName] = useState<string | null>(null);
  const [noTeam, setNoTeam] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      const teams = await fetch("/api/teams").then((r) => (r.ok ? r.json() : []));
      if (!Array.isArray(teams) || teams.length === 0) {
        setNoTeam(true);
        setTiles([]);
        return;
      }
      const cookieId = document.cookie.match(/activeTeamId=([^;]+)/)?.[1];
      const team = teams.find((t: { id: string }) => t.id === cookieId) ?? teams[0];
      setTeamName(teams.length > 1 ? team.name : null);

      const data = await fetch(`/api/group-tiles?teamId=${team.id}`).then((r) =>
        r.ok ? r.json() : null
      );
      if (!data) {
        setTiles([]);
        return;
      }
      setTiles([
        { id: null, name: "すべての動画", color: null, count: data.all.count, cover: data.all.cover },
        ...data.groups,
      ]);
    })();
  }, [status]);

  if (status === "loading" || (status === "authenticated" && tiles === null)) {
    return <div className="max-w-3xl mx-auto px-4 py-12 text-center text-neutral-500">Loading...</div>;
  }

  if (status === "unauthenticated") {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-neutral-100 mb-3">Welcome to FilmRoom</h1>
        <p className="text-neutral-500 text-sm mb-6">Log in to view your team&apos;s video board.</p>
        <Link
          href="/login"
          className="inline-block bg-cta hover:bg-cta-hover text-cta-ink px-6 py-2.5 rounded-lg text-sm transition"
        >
          Log In
        </Link>
      </div>
    );
  }

  if (noTeam) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-neutral-100 mb-3">Join a Team</h1>
        <p className="text-neutral-500 text-sm mb-6">
          You need to create or join a team before you can see the board.
        </p>
        <Link
          href="/teams/new"
          className="inline-block bg-cta hover:bg-cta-hover text-cta-ink px-6 py-2.5 rounded-lg text-sm transition"
        >
          Create or Join Team
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-8">
      <div className="flex items-baseline gap-2 mb-1 min-w-0">
        <h1 className="text-2xl font-bold text-neutral-100 shrink-0">どの動画を見ますか？</h1>
        {teamName && (
          <span className="text-sm text-neutral-500 truncate min-w-0" title={teamName}>
            {teamName}
          </span>
        )}
      </div>
      <p className="text-sm text-neutral-500 mb-6">グループを選ぶと、その動画だけが並びます。</p>

      {/* Two up on a phone, three from tablet width. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {(tiles ?? []).map((t) => (
          <Link
            key={t.id ?? "__all__"}
            href={t.id ? `/timeline?group=${encodeURIComponent(t.id)}` : "/timeline"}
            className="liquid-glass group relative block aspect-[4/3] rounded-2xl overflow-hidden transition hover:brightness-110 active:scale-[0.98]"
          >
            {t.cover && !noCover.has(t.id ?? "__all__") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={posterUrlFor(t.cover)}
                alt=""
                loading="lazy"
                onError={() =>
                  setNoCover((prev) => {
                    const next = new Set(prev);
                    next.add(t.id ?? "__all__");
                    return next;
                  })
                }
                className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: hexAlpha(t.color, 0.25) ?? "var(--lift-2)",
                }}
              />
            )}

            {/* The name has to stay legible over any frame, so it sits on a
                gradient that only darkens the bottom of the tile. */}
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />

            {t.color && (
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1"
                style={{ backgroundColor: t.color }}
              />
            )}

            <div className="absolute inset-x-0 bottom-0 p-3">
              <div className="text-sm font-semibold text-white drop-shadow break-words">{t.name}</div>
              <div className="text-[11px] text-white/70">{t.count} 件</div>
            </div>
          </Link>
        ))}
      </div>

      {tiles && tiles.length <= 1 && (
        <p className="mt-6 text-sm text-neutral-500">
          グループはまだありません。チーム設定で作ると、ここに並びます。
        </p>
      )}
    </div>
  );
}
