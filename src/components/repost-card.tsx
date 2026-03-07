"use client";

import { PostCard } from "./post-card";
import { timeAgo } from "@/lib/time";
import Link from "next/link";

interface RepostUser {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
  avatar: string | null;
}

interface RepostCardProps {
  repost: {
    id: string;
    content: string | null;
    createdAt: Date;
    user: RepostUser;
    post: {
      id: string;
      content: string;
      createdAt: Date;
      editedAt?: Date | null;
      isSensitive: boolean;
      isNsfw: boolean;
      isPinned: boolean;
      author: RepostUser;
      tags?: Array<{ tag: { name: string } }>;
      _count: {
        comments: number;
        likes: number;
        bookmarks: number;
        reposts: number;
      };
      likes: Array<{ id: string }>;
      bookmarks: Array<{ id: string }>;
      reposts: Array<{ id: string }>;
      comments: Array<{
        id: string;
        content: string;
        createdAt: Date;
        author: RepostUser;
      }>;
    };
  };
  currentUserId?: string;
  phoneVerified: boolean;
  biometricVerified: boolean;
  showNsfwByDefault: boolean;
}

export function RepostCard({
  repost,
  currentUserId,
  phoneVerified,
  biometricVerified,
  showNsfwByDefault,
}: RepostCardProps) {
  const reposterName = repost.user.displayName || repost.user.name || repost.user.username;

  return (
    <div>
      {/* Repost header */}
      <div className="mb-1 flex items-center gap-1.5 pl-2 text-xs text-zinc-500 dark:text-zinc-400">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
        </svg>
        <Link href={`/${repost.user.username}`} className="font-medium hover:underline">
          {reposterName}
        </Link>
        <span>reposted</span>
        <span className="text-zinc-400 dark:text-zinc-500">{timeAgo(repost.createdAt)}</span>
      </div>

      {/* Quote content */}
      {repost.content && (
        <div className="mb-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
          {repost.content}
        </div>
      )}

      {/* Original post */}
      <PostCard
        post={repost.post}
        currentUserId={currentUserId}
        phoneVerified={phoneVerified}
        biometricVerified={biometricVerified}
        showNsfwByDefault={showNsfwByDefault}
      />
    </div>
  );
}
