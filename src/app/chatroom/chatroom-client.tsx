"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { InboundMessage } from "ably";
import Link from "next/link";
import { getAblyRealtimeClient } from "@/lib/ably";
import { useAblyReady } from "@/app/providers";
import { FramedAvatar } from "@/components/framed-avatar";
import { timeAgo } from "@/lib/time";
import { sendChatRoomMessage, editChatRoomMessage, deleteChatRoomMessage } from "./actions";
import type { ChatRoomMessageData } from "./actions";

interface ChatRoomClientProps {
  initialMessages: ChatRoomMessageData[];
  currentUserId: string;
  room: string;
}

export function ChatRoomClient({ initialMessages, currentUserId, room }: ChatRoomClientProps) {
  const [messages, setMessages] = useState<ChatRoomMessageData[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ablyReady = useAblyReady();
  const channelName = `chatroom:${room}`;

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // Ably subscription for real-time messages
  useEffect(() => {
    if (!ablyReady) return;
    const client = getAblyRealtimeClient();
    const channel = client.channels.get(channelName);

    const handler = (event: InboundMessage) => {
      const data = event.data as Record<string, string | null>;
      switch (event.name) {
        case "new": {
          const msg: ChatRoomMessageData = {
            id: data.id as string,
            room: data.room as string,
            senderId: data.senderId as string,
            content: data.content as string,
            sender: JSON.parse(data.sender as string),
            editedAt: data.editedAt ? new Date(data.editedAt) : null,
            deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
            createdAt: new Date(data.createdAt as string),
          };
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          break;
        }
        case "edit": {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.id
                ? { ...m, content: data.content as string, editedAt: new Date(data.editedAt as string) }
                : m
            )
          );
          break;
        }
        case "delete": {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.id ? { ...m, deletedAt: new Date(data.deletedAt as string) } : m
            )
          );
          break;
        }
      }
    };

    channel.subscribe(handler);
    return () => {
      channel.unsubscribe(handler);
    };
  }, [ablyReady, channelName]);

  // Send message
  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setInputValue("");
    try {
      await sendChatRoomMessage(trimmed, room);
    } catch {
      // Restore input on failure
      setInputValue(trimmed);
    }
    setIsSending(false);
    textareaRef.current?.focus();
  };

  // Handle Enter to send (Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Edit message
  const handleEdit = async (messageId: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    await editChatRoomMessage(messageId, trimmed);
    setEditingId(null);
    setEditValue("");
  };

  // Delete message
  const handleDelete = async (messageId: string) => {
    await deleteChatRoomMessage(messageId);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-900">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              No messages yet. Be the first to say something!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isOwn = msg.senderId === currentUserId;
              const isDeleted = !!msg.deletedAt;
              const senderName = msg.sender.displayName || msg.sender.name || msg.sender.username || "?";
              const avatarSrc = msg.sender.avatar || msg.sender.image;
              const initial = senderName[0]?.toUpperCase();

              return (
                <div key={msg.id} className="group flex gap-3">
                  <Link href={`/${msg.sender.username}`} className="shrink-0">
                    <FramedAvatar
                      src={avatarSrc}
                      initial={initial}
                      size={36}
                      frameId={msg.sender.profileFrameId}
                      referrerPolicy="no-referrer"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <Link
                        href={`/${msg.sender.username}`}
                        className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        {senderName}
                      </Link>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                        {timeAgo(new Date(msg.createdAt))}
                        {msg.editedAt && " (edited)"}
                      </span>
                    </div>

                    {isDeleted ? (
                      <p className="text-sm italic text-zinc-400 dark:text-zinc-500">
                        Message deleted
                      </p>
                    ) : editingId === msg.id ? (
                      <div className="mt-1 flex gap-2">
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleEdit(msg.id);
                            }
                            if (e.key === "Escape") {
                              setEditingId(null);
                            }
                          }}
                          className="flex-1 resize-none rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          rows={1}
                          autoFocus
                        />
                        <button
                          onClick={() => handleEdit(msg.id)}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-sm text-zinc-700 dark:text-zinc-300">
                        {msg.content}
                      </p>
                    )}
                  </div>

                  {/* Actions for own messages */}
                  {isOwn && !isDeleted && editingId !== msg.id && (
                    <div className="flex shrink-0 items-start gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => {
                          setEditingId(msg.id);
                          setEditValue(msg.content);
                        }}
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                        title="Edit"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(msg.id)}
                        className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        title="Delete"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="mt-3 flex gap-2">
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
        <button
          onClick={handleSend}
          disabled={!inputValue.trim() || isSending}
          className="rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50"
        >
          {isSending ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
