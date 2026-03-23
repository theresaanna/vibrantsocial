import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { getListMembers } from "../actions";
import { ListMembersClient } from "./list-members-client";
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

  const { list, members } = result;
  const isOwner = list.ownerId === session.user.id;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <Link
          href="/lists"
          className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          &larr; Back to Lists
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-600">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {members.length} {members.length === 1 ? "member" : "members"}
          </p>
        </div>
        <Link
          href={`/feed?list=${list.id}`}
          className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:from-indigo-500 hover:to-violet-500"
        >
          View Feed
        </Link>
      </div>

      <ListMembersClient
        listId={list.id}
        listName={list.name}
        members={JSON.parse(JSON.stringify(members))}
        isOwner={isOwner}
      />
    </main>
  );
}
