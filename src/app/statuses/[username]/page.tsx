import type { Metadata } from "next";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getUserStatusHistory } from "@/app/feed/status-actions";
import { UserStatusHistory } from "@/components/user-status-history";
import { ThemedPage } from "@/components/themed-page";
import { userThemeSelect, buildUserTheme, NO_THEME } from "@/lib/user-theme";
import { prisma } from "@/lib/prisma";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username}'s Statuses`,
    robots: { index: false, follow: false },
  };
}

export default async function UserStatusesPage({ params }: Props) {
  const { username } = await params;
  const session = await auth();
  const currentUserId = session?.user?.id;

  const profileUser = await prisma.user.findUnique({
    where: { username },
    select: { ...userThemeSelect, username: true },
  });
  if (!profileUser) notFound();

  const [statuses, theme] = await Promise.all([
    getUserStatusHistory(username, 30),
    Promise.resolve(buildUserTheme(profileUser)),
  ]);

  return (
    <ThemedPage {...theme}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/statuses"
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Back to statuses"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            @{username}&apos;s Statuses
          </h1>
        </div>

        <UserStatusHistory
          statuses={statuses}
          currentUserId={currentUserId}
          username={username}
        />
      </div>
    </ThemedPage>
  );
}
