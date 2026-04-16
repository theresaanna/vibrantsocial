"use client";

import { useState } from "react";
import Link from "next/link";
import { UserSearch } from "./user-search";
import { FramedAvatar } from "@/components/framed-avatar";
import { StyledName } from "@/components/styled-name";
import {
  updateGroupName,
  addGroupMembers,
  removeGroupMember,
} from "@/app/messages/actions";
import type { ConversationWithParticipants } from "@/types/chat";

interface GroupChatSettingsProps {
  conversation: ConversationWithParticipants;
  currentUserId: string;
  onClose: () => void;
  onConversationUpdate: () => void;
}

export function GroupChatSettings({
  conversation,
  currentUserId,
  onClose,
  onConversationUpdate,
}: GroupChatSettingsProps) {
  const currentParticipant = conversation.participants.find(
    (p) => p.userId === currentUserId
  );
  const isAdmin = currentParticipant?.isAdmin ?? false;

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(conversation.name ?? "");
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveName = async () => {
    if (!nameValue.trim() || nameValue.trim() === conversation.name) {
      setEditingName(false);
      return;
    }
    setIsSaving(true);
    const result = await updateGroupName({
      conversationId: conversation.id,
      name: nameValue,
    });
    setIsSaving(false);
    if (result.success) {
      setEditingName(false);
      onConversationUpdate();
    } else {
      setStatus(result.message);
    }
  };

  const handleAddMembers = async (userId: string) => {
    setIsSaving(true);
    const result = await addGroupMembers({
      conversationId: conversation.id,
      userIds: [userId],
    });
    setIsSaving(false);
    if (result.success) {
      setShowAddMembers(false);
      onConversationUpdate();
    } else {
      setStatus(result.message);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setIsSaving(true);
    const result = await removeGroupMember({
      conversationId: conversation.id,
      userId,
    });
    setIsSaving(false);
    if (result.success) {
      onConversationUpdate();
    } else {
      setStatus(result.message);
    }
  };

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
          {editingName ? (
            <div className="mx-auto max-w-[200px]">
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSaveName();
                  if (e.key === "Escape") {
                    setNameValue(conversation.name ?? "");
                    setEditingName(false);
                  }
                }}
                maxLength={100}
                autoFocus
                className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1 text-center text-base font-medium text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <div className="mt-1 flex justify-center gap-1">
                <button
                  onClick={handleSaveName}
                  disabled={isSaving}
                  className="rounded px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-zinc-800"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setNameValue(conversation.name ?? "");
                    setEditingName(false);
                  }}
                  className="rounded px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1">
              <h4 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                {conversation.name}
              </h4>
              {isAdmin && (
                <button
                  onClick={() => setEditingName(true)}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  aria-label="Edit group name"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M13.488 2.513a1.75 1.75 0 00-2.475 0L6.75 6.774a2.75 2.75 0 00-.596.892l-.848 2.047a.75.75 0 00.98.98l2.047-.848a2.75 2.75 0 00.892-.596l4.261-4.262a1.75 1.75 0 000-2.474z" />
                    <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9A.75.75 0 0114 9v2.25A2.75 2.75 0 0111.25 14h-6.5A2.75 2.75 0 012 11.25v-6.5A2.75 2.75 0 014.75 2H7a.75.75 0 010 1.5H4.75z" />
                  </svg>
                </button>
              )}
            </div>
          )}
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
              const canRemove = isAdmin && !isMe && !p.isAdmin;

              const avatarEl = (
                <FramedAvatar
                  src={avatar}
                  alt={name}
                  initial={name[0]?.toUpperCase()}
                  size={40}
                  frameId={user.profileFrameId}
                />
              );

              const nameEl = (
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  <StyledName fontId={user.usernameFont}>{name}</StyledName>
                  {isMe && (
                    <span className="ml-1 text-xs text-zinc-400">(you)</span>
                  )}
                </p>
              );

              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2"
                >
                  {user.username ? (
                    <Link href={`/${user.username}`} onClick={onClose} className="flex items-center gap-3 min-w-0 flex-1">
                      {avatarEl}
                      <div className="min-w-0 flex-1">{nameEl}</div>
                    </Link>
                  ) : (
                    <>
                      {avatarEl}
                      <div className="min-w-0 flex-1">{nameEl}</div>
                    </>
                  )}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {p.isAdmin && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        Admin
                      </span>
                    )}
                    {canRemove && (
                      <button
                        onClick={() => handleRemoveMember(p.userId)}
                        disabled={isSaving}
                        className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                        aria-label={`Remove ${name}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                          <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isAdmin && (
          <div className="mt-3">
            {showAddMembers ? (
              <div className="space-y-2">
                <UserSearch
                  onSelect={(user) => handleAddMembers(user.id)}
                  excludeIds={conversation.participants.map((p) => p.userId)}
                  placeholder="Search users to add..."
                />
                <button
                  onClick={() => setShowAddMembers(false)}
                  className="w-full rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddMembers(true)}
                className="w-full rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
              >
                + Add Members
              </button>
            )}
          </div>
        )}

        {status && (
          <p className="mt-2 text-center text-xs text-red-500">{status}</p>
        )}
      </div>
    </div>
  );
}
