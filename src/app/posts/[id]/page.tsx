"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import BlockRenderer from "@/components/BlockRenderer";
import Chat from "@/components/Chat";
import GroupBadge from "@/components/GroupBadge";
import TagList from "@/components/TagList";
import Link from "next/link";
import type { Block } from "@/lib/types";

function EditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

interface Post {
  id: string;
  title: string;
  blocks: Block[];
  createdAt: string;
  authorId: string;
  teamId: string;
  author: { name: string };
  tags: { id: string; name: string; color?: string | null }[];
  group: { id: string; name: string; color: string | null } | null;
}

export default function PostPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();
  const [post, setPost] = useState<Post | null>(null);
  const [tagColors, setTagColors] = useState<Map<string, string | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/posts/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setPost(data);
        setLoading(false);
        // Load the team's tag colours so media tags render with their colour too.
        if (data?.teamId) {
          fetch(`/api/tags?teamId=${data.teamId}`)
            .then((r) => (r.ok ? r.json() : []))
            .then((tags: { name: string; color: string | null }[]) => {
              if (Array.isArray(tags)) setTagColors(new Map(tags.map((t) => [t.name, t.color])));
            });
        }
      });
  }, [id]);

  async function handleShare() {
    const url = window.location.href;
    const title = post?.title || "";

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // ユーザーがキャンセルした場合
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center text-neutral-500">
        Loading...
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center text-neutral-500">
        Post not found
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link href="/" className="text-neutral-400 text-sm hover:text-neutral-200 transition">
          ← Back
        </Link>
        <div className="flex gap-2">
          {session?.user?.id === post.authorId && (
            <Link
              href={`/posts/${post.id}/edit`}
              aria-label="Edit"
              title="Edit"
              className="flex items-center justify-center w-10 h-10 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300 transition"
            >
              <EditIcon />
            </Link>
          )}
          <button
            onClick={handleShare}
            aria-label={copied ? "Copied" : "Share"}
            title={copied ? "Copied" : "Share"}
            className="flex items-center justify-center w-10 h-10 bg-neutral-700 hover:bg-neutral-600 text-neutral-100 rounded-lg transition"
          >
            {copied ? <CheckIcon /> : <ShareIcon />}
          </button>
        </div>
      </div>

      <article id="article-content" className="mb-8">
        {post.group && (
          <div className="mb-2">
            <GroupBadge group={post.group} className="px-2.5 py-1" />
          </div>
        )}
        <h1 className="text-3xl font-bold text-neutral-100 mb-3">{post.title}</h1>
        <div className="flex items-center gap-3 text-sm text-neutral-500 mb-3">
          <span>{post.author.name}</span>
          <span>·</span>
          <time>{new Date(post.createdAt).toLocaleDateString("en-US")}</time>
        </div>
        {post.tags.length > 0 && (
          <div className="mb-6">
            <TagList
              tags={post.tags.map((t) => ({
                name: t.name,
                color: t.color ?? tagColors.get(t.name) ?? null,
              }))}
              max={4}
            />
          </div>
        )}

        <BlockRenderer blocks={post.blocks} tagColors={tagColors} />
      </article>

      {session ? (
        <div className="print:hidden">
          <Chat postId={post.id} />
        </div>
      ) : (
        <div className="print:hidden bg-neutral-900 border border-neutral-800 rounded-xl p-6 text-center">
          <p className="text-neutral-500 text-sm mb-2">Log in to join the discussion</p>
          <Link
            href="/login"
            className="text-neutral-400 text-sm hover:text-neutral-200 transition"
          >
            Log In / Sign Up
          </Link>
        </div>
      )}
    </div>
  );
}
