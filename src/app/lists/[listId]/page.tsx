import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { getListMembers, getListCollaborators, isSubscribedToList } from "../actions";
import { ListMembersClient } from "./list-members-client";
import { SubscribeListButton } from "./subscribe-list-button";
import { ShareListButton } from "@/components/share-list-button";
import { FramedAvatar } from "@/components/framed-avatar";
import { userThemeSelect, buildUserTheme, NO_THEME } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";
import Link from "next/link";

export const metadata: Metadata = {
  title: "List Details",
  robots: { index: false, follow: false },
};

interface ListDetailPageProps {
  params: Promise<{ listId: string }>;
}

export default async function ListDetailPage({ params }: ListDetailPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { listId } = await params;
  const result = await getListMembers(listId);
  if (!result) notFound();

  const { list, members, isCollaborator } = result;
  const isOwner = list.ownerId === session.user.id;
  const canManageMembers = isOwner || isCollaborator;
  const [isSubscribed, collaborators, ownerThemeUser] = await Promise.all([
    !isOwner ? isSubscribedToList(listId) : Promise.resolve(false),
    isOwner ? getListCollaborators(listId) : Promise.resolve([]),
    prisma.user.findUnique({
      where: { id: list.ownerId },
      select: userThemeSelect,
    }),
  ]);

  const theme = ownerThemeUser ? buildUserTheme(ownerThemeUser) : NO_THEME;

  const ownerName = list.owner.displayName || list.owner.name || list.owner.username || "Unknown";
  const ownerAvatar = list.owner.avatar || list.owner.image;
  const ownerInitial = ownerName[0]?.toUpperCase();

  return (
    <ThemedPage {...theme}>
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <Link
          href="/lists"
          className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          &larr; Back to Lists
        </Link>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-600">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {members.length} {members.length === 1 ? "member" : "members"}
              </p>
              <div className="flex items-center gap-1.5">
                <FramedAvatar src={ownerAvatar} initial={ownerInitial} size={16} frameId={list.owner.profileFrameId} referrerPolicy="no-referrer" />
                <Link
                  href={`/${list.owner.username}`}
                  className="text-xs text-zinc-500 hover:underline dark:text-zinc-400"
                >
                  by {ownerName}
                </Link>
                {list.isPrivate && (
                  <span className="ml-1 inline-flex items-center rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    Private
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ShareListButton listId={list.id} listName={list.name} />
            {!isOwner && (
              <SubscribeListButton listId={list.id} isSubscribed={isSubscribed} />
            )}
            <Link
              href={`/feed?list=${list.id}`}
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:from-indigo-500 hover:to-violet-500"
            >
              View Feed
            </Link>
          </div>
        </div>

        <ListMembersClient
          listId={list.id}
          listName={list.name}
          isPrivate={list.isPrivate}
          members={JSON.parse(JSON.stringify(members))}
          isOwner={isOwner}
          canManageMembers={canManageMembers}
          collaborators={JSON.parse(JSON.stringify(collaborators))}
        />
      </div>
    </main>
    </ThemedPage>
  );
}
