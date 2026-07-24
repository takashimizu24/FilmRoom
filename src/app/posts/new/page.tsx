"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import BlockEditor from "@/components/BlockEditor";
import TagAutocomplete from "@/components/TagAutocomplete";
import type { MediaItem } from "@/components/MediaPicker";
import type { Block } from "@/lib/types";

interface Team {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  color: string | null;
}

interface TagSuggestion {
  name: string;
  color: string | null;
}

export default function NewPostPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([{ type: "text", content: "" }]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<TagSuggestion[]>([]);
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<string>("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    fetch("/api/teams")
      .then((res) => res.json())
      .then((data: Team[]) => {
        setTeams(data);
        const cookieId = document.cookie.match(/activeTeamId=([^;]+)/)?.[1];
        setTeamId(cookieId && data.some((t) => t.id === cookieId) ? cookieId : data[0]?.id ?? "");
      });
  }, [session]);

  useEffect(() => {
    if (!teamId) return;
    fetch(`/api/groups?teamId=${teamId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Group[]) => {
        setGroups(Array.isArray(data) ? data : []);
        setGroupId((prev) => (data.some((g) => g.id === prev) ? prev : ""));
      });
    fetch(`/api/tags?teamId=${teamId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: TagSuggestion[]) =>
        setTagSuggestions(Array.isArray(data) ? data.map((t) => ({ name: t.name, color: t.color })) : [])
      )
      .catch(() => setTagSuggestions([]));
    fetch(`/api/media?teamId=${teamId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: MediaItem[]) => setMediaLibrary(Array.isArray(data) ? data : []))
      .catch(() => setMediaLibrary([]));
  }, [teamId]);

  if (!session) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-neutral-500">
        Please log in to post
      </div>
    );
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const nonEmptyBlocks = blocks.filter((b) => {
      if (b.type === "text") return b.content.trim().length > 0;
      if (b.type === "youtube") return b.url.trim().length > 0;
      return true;
    });

    if (nonEmptyBlocks.length === 0) {
      setError("Please add some content");
      return;
    }

    if (!teamId) {
      setError("Please select a team");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, blocks: nonEmptyBlocks, teamId, tags, groupId: groupId || null }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create post");
      return;
    }

    const post = await res.json();
    router.push(`/posts/${post.id}`);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-neutral-100 mb-6">New Post</h1>
      {error && (
        <div className="bg-red-900/30 text-red-400 p-3 rounded-lg mb-4 text-sm">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-5">
        {teams.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Team</label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-700 rounded-lg text-neutral-100 bg-neutral-800 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-neutral-400 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. vs Team A - Q3 Analysis"
            className="w-full px-4 py-2 border border-neutral-700 rounded-lg text-neutral-100 bg-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
          />
        </div>

        {groups.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Group</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-700 rounded-lg text-neutral-100 bg-neutral-800 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
            >
              <option value="">No group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-neutral-400 mb-1">Tags</label>
          <div className="mb-2">
            <TagAutocomplete
              onAdd={(name) => {
                if (!tags.includes(name)) setTags([...tags, name]);
              }}
              suggestions={tagSuggestions}
              existing={tags}
              placeholder="e.g. offense, Q3"
            />
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1.5 px-3 py-1 bg-neutral-800 rounded-full text-xs text-neutral-300"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-neutral-500 hover:text-neutral-300"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-400 mb-2">Content</label>
          <div className="pl-10">
            <BlockEditor
              blocks={blocks}
              onChange={setBlocks}
              tagSuggestions={tagSuggestions}
              mediaLibrary={mediaLibrary}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-neutral-700 text-neutral-100 py-3 rounded-lg hover:bg-neutral-600 disabled:opacity-50 transition font-medium"
        >
          {submitting ? "Posting..." : "Post"}
        </button>
      </form>
    </div>
  );
}
