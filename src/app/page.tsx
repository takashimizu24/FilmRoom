"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { Block } from "@/lib/types";
import { YouTubePlayer, UploadedVideo } from "@/components/VideoPlayer";
import GroupBadge, { FolderIcon } from "@/components/GroupBadge";
import TagPill from "@/components/TagPill";
import { contrastText } from "@/lib/color";

interface Tag {
  name: string;
  count: number;
  color: string | null;
}

interface Group {
  id: string;
  name: string;
  color: string | null;
  count: number;
}

interface Post {
  id: string;
  title: string;
  blocks: Block[];
  createdAt: string;
  author: { name: string };
  tags: { id: string; name: string; color?: string | null }[];
  groupId: string | null;
  group: { id: string; name: string; color: string | null } | null;
  _count: { messages: number };
}

function getMediaCounts(blocks: Block[]) {
  let videos = 0;
  let images = 0;
  for (const b of blocks) {
    if (b.type === "video" || b.type === "youtube") videos++;
    if (b.type === "image") images++;
  }
  return { videos, images };
}

function isMedia(block: Block): boolean {
  return block.type === "video" || block.type === "image" || block.type === "youtube";
}

function MediaTagList({ tags, colorMap }: { tags?: string[]; colorMap: Map<string, string | null> }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {tags.map((t) => (
        <TagPill key={t} name={t} color={colorMap.get(t) ?? null} />
      ))}
    </div>
  );
}

function MediaBlock({ block }: { block: Block }) {
  if (block.type === "youtube") {
    return <YouTubePlayer url={block.url} startTime={block.startTime} endTime={block.endTime} />;
  }
  if (block.type === "video") {
    return <UploadedVideo url={block.url} />;
  }
  if (block.type === "image") {
    return (
      <div className="rounded-xl overflow-hidden">
        <img src={block.url} alt="" className="w-full" />
      </div>
    );
  }
  return null;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [matchMode, setMatchMode] = useState<"and" | "or">("and");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [noTeam, setNoTeam] = useState(false);

  function toggleTag(name: string) {
    setActiveTags((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
    );
  }

  useEffect(() => {
    if (status !== "authenticated") return;

    async function load() {
      const teamsRes = await fetch("/api/teams");
      const teamsData = await teamsRes.json();
      if (!teamsData.length) {
        setNoTeam(true);
        setLoading(false);
        return;
      }
      const activeId = document.cookie.match(/activeTeamId=([^;]+)/)?.[1];
      const teamId = teamsData.some((t: { id: string }) => t.id === activeId) ? activeId : teamsData[0].id;

      const [postsRes, tagsRes, groupsRes] = await Promise.all([
        fetch(`/api/posts?teamId=${teamId}`),
        fetch(`/api/tags?teamId=${teamId}`),
        fetch(`/api/groups?teamId=${teamId}`),
      ]);
      setPosts(await postsRes.json());
      setTags(await tagsRes.json());
      setGroups(await groupsRes.json());

      // Pre-apply tag filter(s) passed via the URL (comma-separated), e.g. from the menu-bar Tags search.
      const urlTag = new URLSearchParams(window.location.search).get("tag");
      if (urlTag) {
        setActiveTags(urlTag.split(",").map((s) => s.trim()).filter(Boolean));
      }

      setLoading(false);
    }
    load();
  }, [status]);

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center text-neutral-500">
        Loading...
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-neutral-100 mb-3">Welcome to FilmRoom</h1>
        <p className="text-neutral-500 text-sm mb-6">
          Log in to view your team&apos;s video board.
        </p>
        <Link
          href="/login"
          className="inline-block bg-neutral-700 hover:bg-neutral-600 text-neutral-100 px-6 py-2.5 rounded-lg text-sm transition"
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
          className="inline-block bg-neutral-700 hover:bg-neutral-600 text-neutral-100 px-6 py-2.5 rounded-lg text-sm transition"
        >
          Create or Join Team
        </Link>
      </div>
    );
  }

  const searchTerm = search.trim().toLowerCase();
  const colorMap = new Map<string, string | null>(tags.map((t) => [t.name, t.color]));

  // Group filter applies first, forming the base set for both views.
  const basePosts = activeGroupId ? posts.filter((p) => p.groupId === activeGroupId) : posts;

  // When one or more tags are selected, we show a flat list of the tagged media
  // (clips), not posts. A media block matches a tag if it carries the tag directly
  // OR its parent post has the tag. Match mode: "and" (all) narrows, "or" (any) combines.
  const mediaItems =
    activeTags.length > 0
      ? basePosts
          .flatMap((post) => {
            const postTagNames = post.tags.map((t) => t.name);
            const matchesTag = (block: Block, tag: string) =>
              postTagNames.includes(tag) ||
              ("tags" in block ? (block.tags ?? []).includes(tag) : false);
            return post.blocks
              .map((block, idx) => ({ block, key: `${post.id}-${idx}`, post }))
              .filter(
                ({ block }) =>
                  isMedia(block) &&
                  (matchMode === "and"
                    ? activeTags.every((tag) => matchesTag(block, tag))
                    : activeTags.some((tag) => matchesTag(block, tag)))
              );
          })
          .filter(({ post }) => !searchTerm || post.title.toLowerCase().includes(searchTerm))
      : [];

  const tagLabel = activeTags.map((t) => `#${t}`).join(matchMode === "and" ? " + " : " or ");

  const filteredPosts = basePosts.filter(
    (post) => !searchTerm || post.title.toLowerCase().includes(searchTerm)
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-neutral-100 mb-6">
        {activeTags.length > 0 ? `Clips tagged ${tagLabel}` : "Posts"}
      </h1>

      <div className="mb-6 space-y-3">
        {/* Group tabs — squared, folder-icon style so they read as categories (vs #tag pills) */}
        {groups.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-600 mr-1">Groups:</span>
            <button
              onClick={() => setActiveGroupId(null)}
              className={`px-3 py-1 rounded-md text-xs transition ${
                activeGroupId === null
                  ? "bg-neutral-200 text-neutral-900"
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
              }`}
            >
              All Groups
            </button>
            {groups.map((g) => {
              const active = activeGroupId === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setActiveGroupId(active ? null : g.id)}
                  style={active ? { backgroundColor: g.color || "#e5e5e5", color: contrastText(g.color) } : undefined}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition inline-flex items-center gap-1.5 ${
                    active ? "" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  <span style={active ? undefined : { color: g.color || "#a3a3a3" }} className="inline-flex">
                    <FolderIcon />
                  </span>
                  {g.name} ({g.count})
                </button>
              );
            })}
          </div>
        )}

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title..."
          className="w-full px-4 py-2 border border-neutral-700 rounded-lg text-sm text-neutral-100 bg-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
        />
      </div>

      {activeTags.length > 0 ? (
        // Tag view: a list of the individual tagged clips/media.
        mediaItems.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <p className="mb-2">No clips tagged {tagLabel}</p>
            <button
              onClick={() => setActiveTags([])}
              className="text-neutral-400 hover:text-neutral-200 text-sm transition"
            >
              Back to all posts
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {mediaItems.map(({ block, key, post }) => (
              <div key={key} className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
                <MediaBlock block={block} />
                <MediaTagList tags={"tags" in block ? block.tags : undefined} colorMap={colorMap} />
                <div className="flex items-center gap-2 text-xs text-neutral-500 mt-3">
                  {post.group && <GroupBadge group={post.group} />}
                  <Link href={`/posts/${post.id}`} className="text-neutral-400 hover:text-neutral-200 transition truncate">
                    {post.title}
                  </Link>
                  <span>·</span>
                  <span>{post.author.name}</span>
                  <span>·</span>
                  <time>{new Date(post.createdAt).toLocaleDateString("en-US")}</time>
                </div>
              </div>
            ))}
          </div>
        )
      ) : filteredPosts.length === 0 ? (
        // Default view: posts.
        <div className="text-center py-12 text-neutral-500">
          {posts.length === 0 ? (
            <>
              <p className="mb-2">No posts yet</p>
              <Link href="/posts/new" className="text-neutral-400 hover:text-neutral-200 text-sm transition">
                Create your first post
              </Link>
            </>
          ) : (
            <p>No posts match your filter</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const { videos, images } = getMediaCounts(post.blocks);
            return (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="block bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-neutral-600 transition"
              >
                <div className="flex items-start gap-2 mb-1.5">
                  {post.group && <span className="mt-0.5 shrink-0"><GroupBadge group={post.group} /></span>}
                  <h2 className="text-base font-semibold text-neutral-100 truncate">
                    {post.title}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                  <span>{post.author.name}</span>
                  <span>·</span>
                  <time>{new Date(post.createdAt).toLocaleDateString("en-US")}</time>
                  {videos > 0 && <span>🎬 {videos}</span>}
                  {images > 0 && <span>🖼 {images}</span>}
                  {post._count.messages > 0 && <span>💬 {post._count.messages}</span>}
                  {post.tags.map((t) => (
                    <TagPill key={t.id} name={t.name} color={t.color ?? colorMap.get(t.name) ?? null} />
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Tag list — placed below the post list */}
      {tags.length > 0 && (
        <div className="mt-8 pt-6 border-t border-neutral-800 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTags([])}
              className={`px-3 py-1 rounded-full text-xs transition ${
                activeTags.length === 0
                  ? "bg-neutral-200 text-neutral-900"
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
              }`}
            >
              All Posts
            </button>
            {tags.map((tag) => {
              const selected = activeTags.includes(tag.name);
              return (
                <button
                  key={tag.name}
                  onClick={() => toggleTag(tag.name)}
                  aria-pressed={selected}
                  style={tag.color ? { backgroundColor: tag.color, color: contrastText(tag.color) } : undefined}
                  className={`px-3 py-1 rounded-full text-xs transition ${
                    selected ? "ring-2 ring-neutral-100 ring-offset-1 ring-offset-neutral-950" : ""
                  } ${tag.color ? "" : selected ? "bg-neutral-200 text-neutral-900" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}
                >
                  {selected ? "✓ " : ""}#{tag.name} ({tag.count})
                </button>
              );
            })}
          </div>

          {activeTags.length >= 2 && (
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span>Match:</span>
              <div className="inline-flex rounded-lg border border-neutral-700 overflow-hidden">
                <button
                  onClick={() => setMatchMode("and")}
                  className={`px-3 py-1 transition ${
                    matchMode === "and"
                      ? "bg-neutral-200 text-neutral-900"
                      : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                  }`}
                >
                  All tags
                </button>
                <button
                  onClick={() => setMatchMode("or")}
                  className={`px-3 py-1 transition border-l border-neutral-700 ${
                    matchMode === "or"
                      ? "bg-neutral-200 text-neutral-900"
                      : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                  }`}
                >
                  Any tag
                </button>
              </div>
              <span className="text-neutral-600">
                {matchMode === "and" ? "(match every tag)" : "(match any tag)"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
