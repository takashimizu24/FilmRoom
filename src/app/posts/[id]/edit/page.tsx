"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import BlockEditor from "@/components/BlockEditor";
import type { Block } from "@/lib/types";

export default function EditPostPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { data: session, status } = useSession();

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`/api/posts/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.error) {
          setLoading(false);
          return;
        }
        const isAuthor = data.authorId && data.authorId === session?.user?.id;
        setAllowed(!!isAuthor);
        if (isAuthor) {
          setTitle(data.title);
          setBlocks(data.blocks);
          setTags((data.tags ?? []).map((t: { name: string }) => t.name));
          setGroupId(data.groupId ?? "");
          if (data.teamId) {
            fetch(`/api/groups?teamId=${data.teamId}`)
              .then((r) => (r.ok ? r.json() : []))
              .then((gs) => setGroups(Array.isArray(gs) ? gs : []));
          }
        }
        setLoading(false);
      });
  }, [id, status, session?.user?.id]);

  function addTag() {
    const value = tagInput.trim();
    if (value && !tags.includes(value)) setTags([...tags, value]);
    setTagInput("");
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

    setSubmitting(true);
    const res = await fetch(`/api/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, blocks: nonEmptyBlocks, tags, groupId: groupId || null }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save changes");
      return;
    }

    router.push(`/posts/${id}`);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
    } else {
      setDeleting(false);
      alert("Failed to delete the post. Please try again.");
    }
  }

  if (status === "loading" || loading) {
    return <div className="max-w-3xl mx-auto px-4 py-12 text-center text-neutral-500">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-neutral-500">
        Please log in to edit
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-neutral-500">
        <p className="mb-2">You can only edit posts you created.</p>
        <Link href={`/posts/${id}`} className="text-neutral-400 hover:text-neutral-200 text-sm transition">
          Back to post
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-neutral-100 mb-6">Edit Post</h1>
      {error && (
        <div className="bg-red-900/30 text-red-400 p-3 rounded-lg mb-4 text-sm">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-neutral-400 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
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
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="e.g. offense, Q3"
              className="flex-1 px-4 py-2 border border-neutral-700 rounded-lg text-neutral-100 bg-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-300 transition"
            >
              Add
            </button>
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
                    onClick={() => setTags(tags.filter((t) => t !== tag))}
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
            <BlockEditor blocks={blocks} onChange={setBlocks} />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-neutral-700 text-neutral-100 py-3 rounded-lg hover:bg-neutral-600 disabled:opacity-50 transition font-medium"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
          <Link
            href={`/posts/${id}`}
            className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300 transition text-center"
          >
            Cancel
          </Link>
        </div>

        <div className="pt-4 border-t border-neutral-800">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="w-full px-4 py-2.5 bg-neutral-900 hover:bg-red-900 border border-neutral-800 hover:border-red-800 rounded-lg text-sm text-neutral-500 hover:text-red-200 transition disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete this post"}
          </button>
        </div>
      </form>
    </div>
  );
}
