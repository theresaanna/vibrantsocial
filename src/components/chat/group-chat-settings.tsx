"use client";

import type { ConversationWithParticipants } from "@/types/chat";

interface GroupChatSettingsProps {
  conversation: ConversationWithParticipants;
  currentUserId: string;
  onClose: () => void;
}

export function GroupChatSettings({
  conversation,
  currentUserId,
  onClose,
}: GroupChatSettingsProps) {
  const currentParticipant = conversation.participants.find(
    (p) => p.userId === currentUserId
  );
  const isAdmin = currentParticipant?.isAdmin ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Group Info
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

        <div className="mb-4 text-center">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-200 text-2xl font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            #
          </div>
          <h4 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
            {conversation.name}
          </h4>
          <p className="text-xs text-zinc-500">
            {conversation.participants.length} members
          </p>
        </div>

        <div>
          <h5 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Members
          </h5>
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {conversation.participants.map((p) => {
              const user = p.user;
              const avatar = user.avatar ?? user.image;
              const name = user.displayName ?? user.username ?? user.name ?? "User";
              const isMe = p.userId === currentUserId;

              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2"
                >
                  {avatar ? (
                    <img src={avatar} alt={name} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                      {name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {name}
                      {isMe && (
                        <span className="ml-1 text-xs text-zinc-400">(you)</span>
                      )}
                    </p>
                  </div>
                  {p.isAdmin && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      Admin
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
