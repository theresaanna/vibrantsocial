import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FriendsStatusesWidget } from "@/components/friends-statuses-widget";
import { FeedSummaryBanner } from "@/components/feed-summary-banner";
import { pollStatuses } from "@/app/feed/status-actions";
import { fetchFeedSummary } from "@/app/feed/summary-actions";

/**
 * Async server component that renders the status widget, chatroom box,
 * and "while you were away" summary above the feed tabs.
 * Designed to be wrapped in <Suspense>.
 */
export async function FeedTopWidgets({ userId }: { userId: string }) {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastSeenFeedAt: true },
  });

  const lastSeenFeedAt = currentUser?.lastSeenFeedAt?.toISOString() ?? null;

  const [statusData, feedSummaryData] = await Promise.all([
    pollStatuses(10),
    lastSeenFeedAt ? fetchFeedSummary(lastSeenFeedAt) : Promise.resolve(null),
  ]);

  return (
    <>
      <FriendsStatusesWidget
        statuses={statusData.friendStatuses}
        currentUserId={userId}
        initialOwnStatus={statusData.ownStatus}
      />
      <div className="mb-4 flex flex-col gap-4 md:flex-row">
        {lastSeenFeedAt && (
          <div className="min-w-0 flex-1">
            <FeedSummaryBanner lastSeenFeedAt={lastSeenFeedAt} initialData={feedSummaryData ?? undefined} />
          </div>
        )}
        <div className="w-full shrink-0 rounded-2xl bg-zinc-50 p-4 shadow-sm md:w-64 dark:bg-zinc-800">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">
            Most Active Chatrooms
          </h3>
          <ul className="mt-2 space-y-1">
            <li>
              <Link
                href="/communities/chatrooms"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <span className="text-fuchsia-500">#</span>
                General Chat
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
