"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Block } from "@/lib/types";
import { YouTubePlayer, UploadedVideo } from "@/components/VideoPlayer";
import MediaCarousel from "@/components/MediaCarousel";
import GroupBadge, { FolderIcon } from "@/components/GroupBadge";
import TagList from "@/components/TagList";
import { useBoardFilter } from "@/components/BoardFilterContext";
import { groupChipStyle } from "@/lib/chipStyles";
import { groupBlocks, hasGroups } from "@/lib/blocks";
import { hexAlpha } from "@/lib/color";

interface Tag {
  name: string;
  count: number;
  color: string | null;
  tagGroupId: string | null;
  tagGroupName: string | null;
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
    if (b.type === "carousel") {
      for (const it of b.items) {
        if (it.type === "video") videos++;
        else images++;
      }
    }
  }
  return { videos, images };
}

function isMedia(block: Block): boolean {
  return (
    block.type === "video" ||
    block.type === "image" ||
    block.type === "youtube" ||
    block.type === "carousel"
  );
}

// A post row on the board. Shared by the default list and the "ポスト" section
// of the filtered/search results.
function PostCard({ post, colorMap }: { post: Post; colorMap: Map<string, string | null> }) {
  const { videos, images } = getMediaCounts(post.blocks);
  const groupColor = post.group?.color ?? null;
  return (
    <Link
      href={`/posts/${post.id}`}
      style={
        groupColor
          ? {
              // A faint wash of the group's colour rising from the bottom-right
              // corner — enough to tell groups apart at a glance without
              // competing with the glass. It sits in the element's own
              // background, so it tints the pane rather than the text.
              backgroundImage: `linear-gradient(315deg, ${hexAlpha(groupColor, 0.2)}, ${hexAlpha(
                groupColor,
                0.05
              )} 55%, rgba(255,255,255,0) 88%)`,
            }
          : undefined
      }
      className="liquid-glass block rounded-2xl p-4 transition hover:brightness-110"
    >
      <div className="flex flex-wrap items-start gap-x-2 gap-y-1 mb-1.5">
        {post.group && (
          <span className="mt-0.5 shrink-0">
            <GroupBadge group={post.group} />
          </span>
        )}
        <h2 className="text-base font-semibold text-neutral-100 break-words min-w-0">{post.title}</h2>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
        <span>{post.author.name}</span>
        <span>·</span>
        <time>{new Date(post.createdAt).toLocaleDateString("en-US")}</time>
        {videos > 0 && <span>🎬 {videos}</span>}
        {images > 0 && <span>🖼 {images}</span>}
        {post._count.messages > 0 && <span>💬 {post._count.messages}</span>}
        {post.tags.length > 0 && (
          <TagList
            tags={post.tags.map((t) => ({
              name: t.name,
              color: t.color ?? colorMap.get(t.name) ?? null,
            }))}
            max={2}
          />
        )}
      </div>
    </Link>
  );
}

function MediaTagList({ tags, colorMap }: { tags?: string[]; colorMap: Map<string, string | null> }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="mt-2">
      <TagList tags={tags.map((t) => ({ name: t, color: colorMap.get(t) ?? null }))} max={3} />
    </div>
  );
}

function MediaBlock({ block }: { block: Block }) {
  if (block.type === "youtube") {
    return <YouTubePlayer url={block.url} startTime={block.startTime} endTime={block.endTime} />;
  }
  if (block.type === "carousel") {
    return <MediaCarousel items={block.items} />;
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
  const { status } = useSession();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeTeamName, setActiveTeamName] = useState<string | null>(null);
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [noTeam, setNoTeam] = useState(false);

  // The filter controls themselves live in the header's menu, so what they set
  // is shared state rather than this page's.
  const {
    titleQuery,
    setTitleQuery,
    activeGroupId,
    setActiveGroupId,
    activeTags,
    setActiveTags,
    toggleTag,
    matchMode,
    clearFilters,
  } = useBoardFilter();

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
      const activeTeam = teamsData.find((t: { id: string }) => t.id === teamId) ?? teamsData[0];
      setActiveTeamName(activeTeam?.name ?? null);
      setTeamCount(teamsData.length);

      const [postsRes, tagsRes, groupsRes] = await Promise.all([
        fetch(`/api/posts?teamId=${teamId}`),
        fetch(`/api/tags?teamId=${teamId}`),
        fetch(`/api/groups?teamId=${teamId}`),
      ]);
      setPosts(await postsRes.json());
      setTags(await tagsRes.json());
      setGroups(await groupsRes.json());

      // Pre-apply tag filter(s) passed via the URL (comma-separated), so a
      // filtered board survives a reload and can be shared as a link.
      const urlTag = new URLSearchParams(window.location.search).get("tag");
      if (urlTag) {
        setActiveTags(urlTag.split(",").map((s) => s.trim()).filter(Boolean));
      }

      setLoading(false);
    }
    load();
  }, [status, setActiveTags]);

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

  const searchTerm = titleQuery.trim().toLowerCase();
  const colorMap = new Map<string, string | null>(tags.map((t) => [t.name, t.color]));

  // Group filter applies first, forming the base set for both views.
  const basePosts = activeGroupId ? posts.filter((p) => p.groupId === activeGroupId) : posts;

  const tagLabel = activeTags.map((t) => `#${t}`).join(matchMode === "and" ? " + " : " or ");

  // Filtering by tag or searching by title shows results in two separate
  // sections: the individual clips (threads) that match, then the posts that
  // match as a whole. Threads come first.
  const filtering = activeTags.length > 0 || !!searchTerm;

  const matchesTags = (names: string[]) =>
    matchMode === "and"
      ? activeTags.every((tag) => names.includes(tag))
      : activeTags.some((tag) => names.includes(tag));

  // Threads: media blocks matched by their OWN tags (a post-level tag surfaces
  // the post in the section below instead of flooding this list with its clips).
  const blockMatches = (block: Block, post: Post) => {
    if (!isMedia(block)) return false;
    const blockTags = "tags" in block ? block.tags ?? [] : [];
    if (activeTags.length > 0 && !matchesTags(blockTags)) return false;
    if (searchTerm) {
      const caption = "caption" in block ? block.caption ?? "" : "";
      const haystack = `${caption} ${post.title}`.toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }
    return true;
  };

  // A hit is shown with the set it belongs to, so a clip arrives together with
  // the text that explains it. Posts that don't use grouping keep the old
  // behaviour of listing the matching clip on its own.
  const mediaItems = filtering
    ? basePosts.flatMap((post) => {
        if (!hasGroups(post.blocks)) {
          return post.blocks
            .map((block, index) => ({ block, index }))
            .filter(({ block }) => blockMatches(block, post))
            .map(({ block, index }) => ({
              key: `${post.id}-${index}`,
              post,
              title: undefined as string | undefined,
              items: [{ block, index }],
            }));
        }
        return groupBlocks(post.blocks)
          .filter((group) => group.items.some(({ block }) => blockMatches(block, post)))
          .map((group) => ({
            key: `${post.id}-g${group.startIndex}`,
            post,
            title: group.title,
            items: group.items,
          }));
      })
    : [];

  // Posts: matched by their own (post-level) tags and/or title.
  const matchedPosts = basePosts.filter((post) => {
    if (activeTags.length > 0 && !matchesTags(post.tags.map((t) => t.name))) return false;
    if (searchTerm && !post.title.toLowerCase().includes(searchTerm)) return false;
    return true;
  });

  // Unfiltered board.
  const filteredPosts = matchedPosts;

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;

  // A group on its own doesn't change the layout (still a plain list of posts),
  // but it does have to be visible — with the group tabs now in the menu, the
  // chip row is the only thing saying why the board is shorter than usual.
  const anyFilter = filtering || activeGroup !== null;

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-8">
      <div className="flex items-baseline gap-2 mb-6 min-w-0">
        <h1 className="text-2xl font-bold text-neutral-100 shrink-0">
          {activeTags.length > 0
            ? `検索結果 ${tagLabel}`
            : searchTerm
              ? "検索結果"
              : "Posts"}
        </h1>
        {!anyFilter && teamCount > 1 && activeTeamName && (
          <span className="text-sm text-neutral-500 truncate min-w-0" title={activeTeamName}>
            {activeTeamName}
          </span>
        )}
      </div>

      {/* What is currently narrowing the board. The controls themselves are in
          the menu, so this row is what tells you a filter is on — and each chip
          removes itself, without reopening the menu. */}
      {anyFilter && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {activeGroup && (
            <button
              onClick={() => setActiveGroupId(null)}
              aria-label={`${activeGroup.name} の絞り込みを解除`}
              style={groupChipStyle(activeGroup.color, true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium backdrop-blur-md backdrop-saturate-150 transition"
            >
              <FolderIcon />
              {activeGroup.name}
              <span aria-hidden className="text-sm leading-none opacity-70">
                ×
              </span>
            </button>
          )}

          {activeTags.map((name) => (
            <button
              key={name}
              onClick={() => toggleTag(name)}
              aria-label={`#${name} の絞り込みを解除`}
              style={{
                backgroundColor: hexAlpha(colorMap.get(name), 0.16) ?? "rgba(255,255,255,0.06)",
                borderColor: hexAlpha(colorMap.get(name), 0.4) ?? "rgba(255,255,255,0.12)",
                color: colorMap.get(name) ?? "#d4d4d4",
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border backdrop-blur-md transition hover:brightness-125"
            >
              #{name}
              <span aria-hidden className="text-sm leading-none opacity-70">
                ×
              </span>
            </button>
          ))}

          {searchTerm && (
            <button
              onClick={() => setTitleQuery("")}
              aria-label="タイトル検索を解除"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border border-line bg-lift text-neutral-300 backdrop-blur-md transition hover:bg-lift-2"
            >
              「{titleQuery.trim()}」
              <span aria-hidden className="text-sm leading-none opacity-70">
                ×
              </span>
            </button>
          )}

          <button
            onClick={clearFilters}
            className="px-3 py-1 rounded-full text-xs text-neutral-400 hover:text-neutral-100 transition"
          >
            絞り込みを解除
          </button>
        </div>
      )}

      {filtering ? (
        // Filtered / search results: whole posts first, then the matching clips.
        mediaItems.length === 0 && matchedPosts.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <p className="mb-2">
              {activeTags.length > 0 ? `${tagLabel} に一致する結果はありません` : "一致する結果はありません"}
            </p>
            <button
              onClick={clearFilters}
              className="text-neutral-400 hover:text-neutral-200 text-sm transition"
            >
              絞り込みを解除
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {matchedPosts.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-neutral-400 mb-3">
                  ポスト <span className="text-neutral-600">({matchedPosts.length})</span>
                </h2>
                <div className="space-y-4">
                  {matchedPosts.map((post) => (
                    <PostCard key={post.id} post={post} colorMap={colorMap} />
                  ))}
                </div>
              </section>
            )}

            {mediaItems.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-neutral-400 mb-3">
                  スレッド <span className="text-neutral-600">({mediaItems.length})</span>
                </h2>
                <div className="space-y-6">
                  {mediaItems.map(({ key, post, title, items }) => (
                    // Tapping the card (anywhere but the player or a link) opens
                    // the post the clip belongs to.
                    <div
                      key={key}
                      role="link"
                      tabIndex={0}
                      onClick={(e) => {
                        const el = e.target as HTMLElement;
                        if (el.closest("a,button,video,iframe,input,select,textarea")) return;
                        router.push(`/posts/${post.id}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.target === e.currentTarget) {
                          router.push(`/posts/${post.id}`);
                        }
                      }}
                      className="glass rounded-xl p-4 cursor-pointer hover:border-line-strong transition"
                    >
                      {title && (
                        <h3 className="text-sm font-semibold text-neutral-200 mb-2">{title}</h3>
                      )}
                      <div className="space-y-3">
                        {items.map(({ block, index }) =>
                          block.type === "text" ? (
                            <p
                              key={index}
                              className="text-sm text-neutral-300 leading-relaxed whitespace-pre-line"
                            >
                              {block.content}
                            </p>
                          ) : (
                            <div key={index}>
                              <MediaBlock block={block} />
                              <MediaTagList
                                tags={"tags" in block ? block.tags : undefined}
                                colorMap={colorMap}
                              />
                            </div>
                          )
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 mt-3">
                        {post.group && <GroupBadge group={post.group} />}
                        <Link
                          href={`/posts/${post.id}`}
                          className="text-neutral-400 hover:text-neutral-200 transition truncate min-w-0 max-w-full"
                        >
                          {post.title}
                        </Link>
                        <span className="whitespace-nowrap">· {post.author.name}</span>
                        <time className="whitespace-nowrap">
                          · {new Date(post.createdAt).toLocaleDateString("en-US")}
                        </time>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
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
          {filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} colorMap={colorMap} />
          ))}
        </div>
      )}

    </div>
  );
}
