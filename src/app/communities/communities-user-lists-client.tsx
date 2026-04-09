"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { rpc } from "@/lib/rpc";


type UserListItem = {
  id: string;
  name: string;
  owner: {
    id: string;
    username: string | null;
    displayName: string | null;
    name: string | null;
    avatar: string | null;
    image: string | null;
  };
  _count: { members: number; subscriptions: number };
};

export function CommunitiesUserListsClient() {
  const [lists, setLists] = useState<UserListItem[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await rpc<UserListItem[]>("fetchAllUserLists");
      setLists(result);
    });
  }, []);

  if (lists === null || isPending) {
    return (
      <div className="mt-6 flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-lg dark:bg-zinc-900">
        <p className="text-sm text-zinc-500" data-testid="no-user-lists">
          No lists have been created yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900" data-testid="user-lists-list">
      <div className="space-y-3">
        {lists.map((list) => {
          const ownerName = list.owner.displayName || list.owner.name || list.owner.username || "Unknown";
          return (
            <Link
              key={list.id}
              href={`/lists/${list.id}`}
              className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 text-white text-sm font-bold">
                {list.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {list.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    {(list.owner.avatar || list.owner.image) && (
                      <img
                        src={list.owner.avatar || list.owner.image || ""}
                        alt={ownerName}
                        className="h-3.5 w-3.5 rounded-full object-cover"
                      />
                    )}
                    {ownerName}
                  </span>
                  <span>&middot;</span>
                  <span>{list._count.members} {list._count.members === 1 ? "member" : "members"}</span>
                  {list._count.subscriptions > 0 && (
                    <>
                      <span>&middot;</span>
                      <span>{list._count.subscriptions} {list._count.subscriptions === 1 ? "subscriber" : "subscribers"}</span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
