"use client";

import { useState, useEffect, useMemo } from "react";
import { getAcceptedFriends } from "@/app/feed/close-friends-actions";
import { FramedAvatar } from "@/components/framed-avatar";

interface Friend {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatar: string | null;
  profileFrameId: string | null;
  image: string | null;
}

interface AudiencePickerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function AudiencePicker({
  isOpen,
  onClose,
  selectedIds,
  onSelectionChange,
}: AudiencePickerProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setIsLoading(true);

    getAcceptedFriends().then((result) => {
      if (cancelled) return;
      setFriends(result);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const filteredFriends = useMemo(() => {
    if (!search.trim()) return friends;
    const q = search.toLowerCase();
    return friends.filter(
      (f) =>
        f.username?.toLowerCase().includes(q) ||
        f.displayName?.toLowerCase().includes(q) ||
        f.name?.toLowerCase().includes(q)
    );
  }, [friends, search]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function toggleFriend(id: string) {
    if (selectedSet.has(id)) {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  }

  function selectAll() {
    onSelectionChange(friends.map((f) => f.id));
  }

  function deselectAll() {
    onSelectionChange([]);
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Select custom audience"
    >
      <div className="mx-4 flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Custom Audience
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search + actions */}
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search friends..."
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-500 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
            data-testid="audience-search"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {selectedIds.length} of {friends.length} selected
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300"
                data-testid="select-all"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                data-testid="deselect-all"
              >
                Deselect All
              </button>
            </div>
          </div>
        </div>

        {/* Friend list */}
        <div className="flex-1 overflow-y-auto" data-testid="audience-list">
          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">Loading friends...</p>
          ) : friends.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              No friends to select. Add friends first!
            </p>
          ) : filteredFriends.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              No friends match your search.
            </p>
          ) : (
            filteredFriends.map((friend) => {
              const displayName = friend.displayName ?? friend.username ?? friend.name ?? "User";
              const avatar = friend.avatar ?? friend.image;
              const isSelected = selectedSet.has(friend.id);

              return (
                <label
                  key={friend.id}
                  className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  data-testid={`audience-friend-${friend.id}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleFriend(friend.id)}
                    className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500 dark:border-zinc-600 dark:bg-zinc-700"
                  />
                  <FramedAvatar
                    src={avatar}
                    alt={displayName}
                    initial={displayName[0]?.toUpperCase()}
                    size={36}
                    frameId={friend.profileFrameId}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {displayName}
                    </p>
                    {friend.username && (
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        @{friend.username}
                      </p>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
            data-testid="audience-done"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
