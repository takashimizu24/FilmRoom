"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import BlockRenderer from "@/components/BlockRenderer";
import Chat from "@/components/Chat";
import GroupBadge from "@/components/GroupBadge";
import Link from "next/link";
import type { Block } from "@/lib/types";
import { contrastText } from "@/lib/color";

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

  function handleExportPDF() {
    window.print();
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
              className="flex items-center gap-1.5 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-300 transition"
            >
              Edit
            </Link>
          )}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-100 rounded-lg text-sm transition"
          >
            {copied ? "Copied" : "Share"}
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-300 transition"
          >
            PDF
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
          <div className="flex flex-wrap gap-1.5 mb-6">
            {post.tags.map((t) => {
              const color = t.color ?? tagColors.get(t.name) ?? null;
              return (
                <span
                  key={t.id}
                  className={`text-xs px-2 py-0.5 rounded-full ${color ? "" : "text-neutral-500 bg-neutral-800"}`}
                  style={color ? { backgroundColor: color, color: contrastText(color) } : undefined}
                >
                  #{t.name}
                </span>
              );
            })}
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
