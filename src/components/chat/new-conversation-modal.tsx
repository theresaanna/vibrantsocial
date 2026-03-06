"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserSearch } from "./user-search";
import { startConversation, createGroupConversation } from "@/app/chat/actions";
import type { ChatUserProfile } from "@/types/chat";

interface NewConversationModalProps {
  onClose: () => void;
}

export function NewConversationModal({ onClose }: NewConversationModalProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"direct" | "group">("direct");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Group chat state
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<ChatUserProfile[]>([]);

  const handleDirectSelect = async (user: ChatUserProfile) => {
    setIsLoading(true);
    setStatus("");
    const result = await startConversation(user.id);
    if (result.success && result.conversationId) {
      router.push(`/chat/${result.conversationId}`);
      onClose();
    } else {
      setStatus(result.message);
    }
    setIsLoading(false);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length < 2) return;
    setIsLoading(true);
    setStatus("");
    const result = await createGroupConversation({
      name: groupName,
      participantIds: selectedUsers.map((u) => u.id),
    });
    if (result.success && result.conversationId) {
      router.push(`/chat/${result.conversationId}`);
      onClose();
    } else {
      setStatus(result.message);
    }
    setIsLoading(false);
  };

  const removeUser = (id: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            New Conversation
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex rounded-lg border border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setTab("direct")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === "direct"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            Direct Message
          </button>
          <button
            onClick={() => setTab("group")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === "group"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            Group Chat
          </button>
        </div>

        {tab === "direct" ? (
          <div>
            <UserSearch onSelect={handleDirectSelect} />
            {isLoading && (
              <p className="mt-2 text-sm text-zinc-500">Starting conversation...</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              maxLength={100}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-500 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
            />

            <UserSearch
              onSelect={(user) =>
                setSelectedUsers((prev) =>
                  prev.some((u) => u.id === user.id) ? prev : [...prev, user]
                )
              }
              excludeIds={selectedUsers.map((u) => u.id)}
              placeholder="Add members..."
            />

            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedUsers.map((user) => {
                  const name = user.displayName ?? user.username ?? user.name ?? "User";
                  return (
                    <span
                      key={user.id}
                      className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {name}
                      <button
                        onClick={() => removeUser(user.id)}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                          <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
                        </svg>
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || selectedUsers.length < 2 || isLoading}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isLoading ? "Creating..." : "Create Group"}
            </button>
          </div>
        )}

        {status && (
          <p className={`mt-3 text-sm ${status.includes("sent") ? "text-green-600" : "text-zinc-600 dark:text-zinc-400"}`}>
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
