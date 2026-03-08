"use client";

import Link from "next/link";
import { PostCard } from "@/components/post-card";

interface PostPageClientProps {
  post: React.ComponentProps<typeof PostCard>["post"];
  currentUserId?: string;
  phoneVerified: boolean;
  biometricVerified: boolean;
  showNsfwByDefault: boolean;
  highlightCommentId: string | null;
}

export function PostPageClient({
  post,
  currentUserId,
  phoneVerified,
  biometricVerified,
  showNsfwByDefault,
  highlightCommentId,
}: PostPageClientProps) {
  return (
    <div>
      <Link
        href={currentUserId ? "/feed" : "/"}
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
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
        biometricVerified={biometricVerified}
        showNsfwByDefault={showNsfwByDefault}
        defaultShowComments
        defaultExpanded
        highlightCommentId={highlightCommentId}
      />
    </div>
  );
}
