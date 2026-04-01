"use client";

import { useEffect, useState, useTransition } from "react";
import { SearchUserCard } from "@/components/search-user-card";
import { fetchNewcomers } from "./newcomer-actions";

type NewcomerUser = {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatar: string | null;
  image: string | null;
  profileFrameId: string | null;
  usernameFont?: string | null;
  bio: string | null;
  _count: { followers: number; posts: number };
};

export function CommunitiesNewcomersClient() {
  const [users, setUsers] = useState<NewcomerUser[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await fetchNewcomers();
      setUsers(result);
    });
  }, []);

  if (users === null || isPending) {
    return (
      <div className="mt-6 flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-lg dark:bg-zinc-900">
        <p className="text-sm text-zinc-500" data-testid="no-newcomers">
          No newcomers yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900" data-testid="newcomers-list">
      <div className="space-y-3">
        {users.map((user) => (
          <SearchUserCard key={user.id} user={user} />
        ))}
      </div>
    </div>
  );
}
