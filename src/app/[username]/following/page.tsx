import { auth } from "@/auth";
import { getFollowing } from "@/app/feed/follow-actions";
import { UserList } from "@/components/user-list";
import Link from "next/link";

interface FollowingPageProps {
  params: Promise<{ username: string }>;
}

export default async function FollowingPage({ params }: FollowingPageProps) {
  const { username } = await params;
  const session = await auth();
  const currentUserId = session?.user?.id ?? null;

  const following = await getFollowing(username);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="rounded-2xl bg-white shadow-lg dark:bg-zinc-900">
        <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <Link
            href={`/${username}`}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Back to profile"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            @{username} is Following
          </h1>
        </div>

        <UserList
          users={following}
          currentUserId={currentUserId}
          emptyMessage="Not following anyone yet."
        />
      </div>
    </main>
  );
}
