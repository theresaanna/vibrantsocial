import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getListsForUser } from "@/app/lists/actions";
import { ShareListButton } from "@/components/share-list-button";
import { NsfwBadge } from "@/components/nsfw-badge";
import Link from "next/link";

interface UserListsPageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: UserListsPageProps): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username}'s Lists`,
    description: `See @${username}'s lists on VibrantSocial.`,
    robots: { index: false, follow: false },
  };
}

export default async function UserListsPage({ params }: UserListsPageProps) {
  const { username } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });
  if (!user) notFound();

  const lists = await getListsForUser(user.id);

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
            @{username}&apos;s Lists
          </h1>
        </div>

        <div className="p-4">
          {lists.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No lists yet.
            </p>
          ) : (
            <div className="space-y-2">
              {lists.map((list) => (
                <div
                  key={list.id}
                  className="flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <Link href={`/lists/${list.id}`} className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {list.name}
                    </span>
                    {list.isNsfw && (
                      <span className="ml-2 align-middle">
                        <NsfwBadge />
                      </span>
                    )}
                    <span className="ml-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {list._count.members} {list._count.members === 1 ? "member" : "members"}
                    </span>
                  </Link>
                  <ShareListButton listId={list.id} listName={list.name} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
