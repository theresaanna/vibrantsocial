import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getFriendStatuses } from "@/app/feed/status-actions";
import type { FriendStatusData } from "@/app/feed/status-actions";
import { FramedAvatar } from "@/components/framed-avatar";
import { StyledName } from "@/components/styled-name";
import { StatusComposer } from "@/components/status-composer";
import { StatusLikeButton } from "@/components/status-like-button";
import { timeAgo } from "@/lib/time";
import { ThemedPage } from "@/components/themed-page";
import { userThemeSelect, buildUserTheme, NO_THEME } from "@/lib/user-theme";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Friends' Statuses",
  robots: { index: false, follow: false },
};

export default async function StatusesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [statuses, currentUser] = await Promise.all([
    getFriendStatuses(50),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: userThemeSelect,
    }),
  ]);

  const theme = currentUser ? buildUserTheme(currentUser) : undefined;

  return (
    <ThemedPage {...(theme ?? NO_THEME)}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/feed"
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Back to feed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Friends&apos; Statuses
          </h1>
        </div>

        <StatusComposer />

        {statuses.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            No friend statuses yet. Set yours to get started!
          </p>
        ) : (
          <div className="space-y-3">
            {statuses.map((status: FriendStatusData) => (
              <div
                key={status.id}
                className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800"
                data-testid="friend-status-item"
              >
                <Link href={`/${status.user.username}`} className="shrink-0">
                  <FramedAvatar
                    src={status.user.avatar || status.user.image}
                    alt={status.user.displayName || status.user.username || "User"}
                    size={36}
                    frameId={status.user.profileFrameId}
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <Link
                      href={`/statuses/${status.user.username}`}
                      className="truncate text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      <StyledName fontId={status.user.usernameFont}>
                        {status.user.displayName || status.user.name || status.user.username}
                      </StyledName>
                    </Link>
                    <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                      {timeAgo(status.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm ${
                        status.user.id === session.user.id
                          ? "font-bold text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {status.content}
                    </p>
                    <StatusLikeButton
                      statusId={status.id}
                      username={status.user.username}
                      likeCount={status.likeCount}
                      isLiked={status.isLiked}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ThemedPage>
  );
}
