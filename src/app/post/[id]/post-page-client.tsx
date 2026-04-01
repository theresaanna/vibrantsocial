"use client";

import type React from "react";
import Link from "next/link";
import { PostCard } from "@/components/post-card";

interface WallPostData {
  id: string;
  status: string;
  wallOwner: {
    username: string | null;
    displayName: string | null;
    usernameFont: string | null;
  };
}

interface PostPageClientProps {
  post: React.ComponentProps<typeof PostCard>["post"];
  currentUserId?: string;
  phoneVerified: boolean;
  ageVerified: boolean;
  showGraphicByDefault: boolean;
  hideSensitiveOverlay: boolean;
  showNsfwContent: boolean;
  highlightCommentId: string | null;
  wallPost?: WallPostData | null;
  wallThemeStyle?: React.CSSProperties;
  wallBgImageStyle?: React.CSSProperties;
  hasWallOwnerTheme?: boolean;
  isWallOwner?: boolean;
  marketplacePostId?: string;
  marketplaceData?: {
    price: number;
    purchaseUrl: string;
    shippingOption: string;
    shippingPrice: number | null;
  };
}

export function PostPageClient({
  post,
  currentUserId,
  phoneVerified,
  ageVerified,
  showGraphicByDefault,
  hideSensitiveOverlay,
  showNsfwContent,
  highlightCommentId,
  wallPost,
  wallThemeStyle,
  wallBgImageStyle,
  hasWallOwnerTheme,
  isWallOwner,
  marketplacePostId,
  marketplaceData,
}: PostPageClientProps) {
  return (
    <div
      className={hasWallOwnerTheme ? "profile-themed" : ""}
      style={{ ...wallThemeStyle, ...wallBgImageStyle }}
    >
      <div className={`rounded-2xl p-6 shadow-lg ${hasWallOwnerTheme ? "profile-container" : "bg-white dark:bg-zinc-900"}`}>
        <Link
          href={currentUserId ? "/feed" : "/"}
          className={`mb-4 inline-flex items-center gap-1 text-sm ${hasWallOwnerTheme ? "profile-text-secondary" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
          data-testid="back-link"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
          {currentUserId ? "Back to feed" : "Back"}
        </Link>
        <PostCard
          post={post}
          currentUserId={currentUserId}
          phoneVerified={phoneVerified}
          ageVerified={ageVerified}
          showGraphicByDefault={showGraphicByDefault}
          hideSensitiveOverlay={hideSensitiveOverlay}
          showNsfwContent={showNsfwContent}
          defaultShowComments
          defaultExpanded
          highlightCommentId={highlightCommentId}
          {...(wallPost && wallPost.wallOwner.username && {
            wallOwner: {
              username: wallPost.wallOwner.username,
              displayName: wallPost.wallOwner.displayName,
              usernameFont: wallPost.wallOwner.usernameFont,
            },
            wallPostId: wallPost.id,
            wallPostStatus: wallPost.status,
          })}
          isWallOwner={isWallOwner}
          marketplacePostId={marketplacePostId}
          marketplaceData={marketplaceData}
        />
      </div>
    </div>
  );
}
