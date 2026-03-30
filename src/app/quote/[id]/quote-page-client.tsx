"use client";

import { RepostCard } from "@/components/repost-card";

interface RepostUser {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
  avatar: string | null;
}

interface QuotePageClientProps {
  repost: {
    id: string;
    content: string | null;
    createdAt: string;
    editedAt?: string | null;
    isPinned?: boolean;
    isSensitive?: boolean;
    isNsfw?: boolean;
    isGraphicNudity?: boolean;
    tags?: Array<{ tag: { name: string } }>;
    user: RepostUser;
    _count: {
      likes: number;
      bookmarks: number;
      comments: number;
    };
    likes: Array<{ id: string }>;
    bookmarks: Array<{ id: string }>;
    post: {
      id: string;
      content: string;
      createdAt: string;
      editedAt?: string | null;
      isAuthorDeleted?: boolean;
      isSensitive: boolean;
      isNsfw: boolean;
      isGraphicNudity: boolean;
      isPinned: boolean;
      author: RepostUser | null;
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
    };
    comments?: Array<{
      id: string;
      content: string;
      createdAt: string;
      author: RepostUser;
      replies?: Array<{
        id: string;
        content: string;
        createdAt: string;
        author: RepostUser;
      }>;
    }>;
  };
  currentUserId?: string;
  phoneVerified: boolean;
  ageVerified: boolean;
  showGraphicByDefault: boolean;
  hideSensitiveOverlay: boolean;
  showNsfwContent: boolean;
}

export function QuotePageClient({
  repost,
  currentUserId,
  phoneVerified,
  ageVerified,
  showGraphicByDefault,
  hideSensitiveOverlay,
  showNsfwContent,
}: QuotePageClientProps) {
  return (
    <div className="rounded-2xl bg-white shadow-lg dark:bg-zinc-900">
      <RepostCard
        repost={repost as any}
        currentUserId={currentUserId}
        phoneVerified={phoneVerified}
        ageVerified={ageVerified}
        showGraphicByDefault={showGraphicByDefault}
        hideSensitiveOverlay={hideSensitiveOverlay}
        showNsfwContent={showNsfwContent}
      />
    </div>
  );
}
