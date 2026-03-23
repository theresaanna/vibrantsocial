"use client";

import { useState, useRef, useCallback, useActionState } from "react";
import Link from "next/link";
import { FramedAvatar } from "@/components/framed-avatar";
import { searchUsersForList, addMemberToList, removeMemberFromList, renameList } from "../actions";

interface MemberUser {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatar: string | null;
  image: string | null;
  profileFrameId: string | null;
  usernameFont: string | null;
}

interface MemberEntry {
  id: string;
  userId: string;
  user: MemberUser;
}

interface SearchUser extends MemberUser {
  isInList: boolean;
}

function UserAvatar({ user }: { user: MemberUser }) {
  const src = user.avatar || user.image;
  const initial = (user.displayName || user.username || "?")[0]?.toUpperCase();
  return (
    <FramedAvatar src={src} initial={initial} size={40} frameId={user.profileFrameId} referrerPolicy="no-referrer" />
  );
}

function RemoveMemberButton({ listId, userId }: { listId: string; userId: string }) {
  const [, formAction, isPending] = useActionState(removeMemberFromList, {
    success: false,
    message: "",
  });

  return (
    <form action={formAction}>
      <input type="hidden" name="listId" value={listId} />
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-red-800 dark:hover:bg-red-900/20 dark:hover:text-red-400"
      >
        {isPending ? "Removing..." : "Remove"}
      </button>
    </form>
  );
}

function AddMemberButton({ listId, userId }: { listId: string; userId: string }) {
  const [, formAction, isPending] = useActionState(addMemberToList, {
    success: false,
    message: "",
  });

  return (
    <form action={formAction}>
      <input type="hidden" name="listId" value={listId} />
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add"}
      </button>
    </form>
  );
}

function RenameListForm({ listId, currentName }: { listId: string; currentName: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [, formAction, isPending] = useActionState(renameList, {
    success: false,
    message: "",
  });

  if (!isEditing) {
    return (
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{name}</h1>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="rounded p-1 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
          title="Rename list"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <form
      action={(formData) => {
        formAction(formData);
        setName(formData.get("name") as string);
        setIsEditing(false);
      }}
      className="mb-4 flex items-center gap-2"
    >
      <input type="hidden" name="listId" value={listId} />
      <input
        type="text"
        name="name"
        defaultValue={name}
        maxLength={50}
        required
        autoFocus
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-lg font-bold text-zinc-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
      >
        {isPending ? "..." : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setIsEditing(false)}
        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        Cancel
      </button>
    </form>
  );
}

export function ListMembersClient({
  listId,
  listName,
  members,
  isOwner,
}: {
  listId: string;
  listName: string;
  members: MemberEntry[];
  isOwner: boolean;
}) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (value.trim().length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      debounceRef.current = setTimeout(async () => {
        const result = await searchUsersForList(listId, value);
        setSearchResults(result.users);
        setIsSearching(false);
      }, 300);
    },
    [listId]
  );

  return (
    <div>
      {/* List name with rename (owner only) */}
      {isOwner ? (
        <RenameListForm listId={listId} currentName={listName} />
      ) : (
        <h1 className="mb-4 text-xl font-bold text-zinc-900 dark:text-zinc-100">{listName}</h1>
      )}

      {/* Search to add members (owner only) */}
      {isOwner && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Add members
          </h2>
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search users to add..."
            className="mb-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />

          {isSearching && (
            <p className="text-sm text-zinc-400">Searching...</p>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm dark:bg-zinc-900"
                >
                  <UserAvatar user={user} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/${user.username}`}
                      className="block truncate text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {user.displayName || user.name || user.username}
                    </Link>
                    <span className="text-sm text-zinc-500">@{user.username}</span>
                  </div>
                  {user.isInList ? (
                    <RemoveMemberButton listId={listId} userId={user.id} />
                  ) : (
                    <AddMemberButton listId={listId} userId={user.id} />
                  )}
                </div>
              ))}
            </div>
          )}

          {query.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
            <p className="text-sm text-zinc-400">No users found.</p>
          )}
        </div>
      )}

      {/* Current members */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Members ({members.length})
        </h2>
        {members.length === 0 ? (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm dark:bg-zinc-900">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {isOwner
                ? "No members yet. Search above to add users to this list."
                : "This list has no members yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm dark:bg-zinc-900"
              >
                <UserAvatar user={member.user} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/${member.user.username}`}
                    className="block truncate text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    {member.user.displayName || member.user.name || member.user.username}
                  </Link>
                  <span className="text-sm text-zinc-500">@{member.user.username}</span>
                </div>
                {isOwner && <RemoveMemberButton listId={listId} userId={member.userId} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
