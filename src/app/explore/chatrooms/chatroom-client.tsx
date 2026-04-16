"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { InboundMessage } from "ably";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePresenceListener } from "ably/react";
import { getAblyRealtimeClient } from "@/lib/ably";
import { useAblyReady } from "@/app/providers";
import { FramedAvatar } from "@/components/framed-avatar";
import { PresenceIndicator } from "@/components/chat/presence-indicator";
import { StyledName } from "@/components/styled-name";
import { ContentFlagsInfoModal } from "@/components/content-flags-info-modal";
import { timeAgo } from "@/lib/time";
import {
  sendChatRoomMessage,
  editChatRoomMessage,
  deleteChatRoomMessage,
  toggleReaction,
  muteUser,
  unmuteUser,
  setChatRoomStatus,
  addModerator,
  removeModerator,
  searchChatRoomUsers,
  getUserProfiles,
} from "./actions";
import type { ChatRoomMessageData, ChatRoomMeta } from "./actions";

const GifSearchModal = dynamic(
  () =>
    import("@/components/editor/toolbar/GifSearchModal").then(
      (mod) => mod.GifSearchModal
    ),
  { ssr: false }
);

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

const PRESENCE_CHANNEL = "presence:global";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatRoomClientProps {
  initialMessages: ChatRoomMessageData[];
  currentUserId: string;
  room: string;
  roomMeta: ChatRoomMeta;
}

interface MentionResult {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatar: string | null;
  image: string | null;
  profileFrameId: string | null;
  usernameFont: string | null;
}

// Shield icon for owner
function OwnerIcon() {
  return (
    <span title="Owner">
      <svg className="h-3.5 w-3.5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.932 9.563 12.348a.749.749 0 00.374 0c5.499-1.416 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
      </svg>
    </span>
  );
}

// Star icon for moderator
function ModIcon() {
  return (
    <span title="Moderator">
      <svg className="h-3.5 w-3.5 text-indigo-500" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
      </svg>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatRoomClient({
  initialMessages,
  currentUserId,
  room,
  roomMeta: initialMeta,
}: ChatRoomClientProps) {
  const [messages, setMessages] = useState<ChatRoomMessageData[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatRoomMessageData | null>(null);
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [roomStatus, setRoomStatus] = useState(initialMeta.status);
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusDraft, setStatusDraft] = useState(initialMeta.status || "");
  const [moderatorIds, setModeratorIds] = useState<string[]>(initialMeta.moderatorIds);
  const [mutedUserIds, setMutedUserIds] = useState<string[]>(
    initialMeta.mutes.map((m) => m.userId)
  );
  const [showModMenu, setShowModMenu] = useState<string | null>(null);
  const [revealedNsfw, setRevealedNsfw] = useState<Set<string>>(new Set());
  const [showContentFlagsInfo, setShowContentFlagsInfo] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<{
    url: string;
    fileType: string;
    fileName: string;
    fileSize: number;
  } | null>(null);
  const [uploadIsNsfw, setUploadIsNsfw] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<MentionResult[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  const mentionTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ablyReady = useAblyReady();
  const channelName = `chatroom:${room}`;

  const isOwner = currentUserId === initialMeta.ownerId;
  const isMod = isOwner || moderatorIds.includes(currentUserId);
  const isMuted = mutedUserIds.includes(currentUserId);

  // -------------------------------------------------------------------------
  // Online users via Ably presence
  // -------------------------------------------------------------------------
  const { presenceData } = usePresenceListener(PRESENCE_CHANNEL);

  const onlineUserIds = useMemo(
    () => new Set(presenceData.map((m) => m.clientId)),
    [presenceData]
  );

  // Profile cache: merge profiles from messages + fetched profiles
  const [fetchedProfiles, setFetchedProfiles] = useState<
    Map<string, ChatRoomMessageData["sender"]>
  >(new Map());
  const fetchingRef = useRef<Set<string>>(new Set());

  // Seed profiles from messages
  const knownProfiles = useMemo(() => {
    const map = new Map<string, ChatRoomMessageData["sender"]>();
    for (const msg of messages) {
      if (!map.has(msg.senderId)) {
        map.set(msg.senderId, msg.sender);
      }
    }
    // Merge fetched profiles
    for (const [id, profile] of fetchedProfiles) {
      if (!map.has(id)) map.set(id, profile);
    }
    return map;
  }, [messages, fetchedProfiles]);

  // Fetch missing profiles when presence changes
  useEffect(() => {
    const missing = Array.from(onlineUserIds).filter(
      (id) => !knownProfiles.has(id) && !fetchingRef.current.has(id)
    );
    if (missing.length === 0) return;

    for (const id of missing) fetchingRef.current.add(id);

    getUserProfiles(missing).then((profiles) => {
      setFetchedProfiles((prev) => {
        const next = new Map(prev);
        for (const p of profiles) next.set(p.id, p);
        return next;
      });
      for (const id of missing) fetchingRef.current.delete(id);
    });
  }, [onlineUserIds, knownProfiles]);

  // Build sorted online user list: current user first, then alphabetical
  const onlineUsers = useMemo(() => {
    const list: ChatRoomMessageData["sender"][] = [];
    for (const id of onlineUserIds) {
      const profile = knownProfiles.get(id);
      if (profile) list.push(profile);
    }
    list.sort((a, b) => {
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      const nameA = (a.displayName || a.name || a.username || "").toLowerCase();
      const nameB = (b.displayName || b.name || b.username || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
    return list;
  }, [onlineUserIds, knownProfiles, currentUserId]);

  // -------------------------------------------------------------------------
  // Scroll to bottom
  // -------------------------------------------------------------------------

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // -------------------------------------------------------------------------
  // Ably subscription
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!ablyReady) return;
    const client = getAblyRealtimeClient();
    const channel = client.channels.get(channelName);

    const handler = (event: InboundMessage) => {
      const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      switch (event.name) {
        case "new": {
          const msg: ChatRoomMessageData = {
            ...data,
            editedAt: data.editedAt ? new Date(data.editedAt) : null,
            deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
            createdAt: new Date(data.createdAt),
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
                ? { ...m, content: data.content, editedAt: new Date(data.editedAt) }
                : m
            )
          );
          break;
        }
        case "delete": {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.id ? { ...m, deletedAt: new Date(data.deletedAt) } : m
            )
          );
          break;
        }
        case "reaction": {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.messageId ? { ...m, reactions: data.reactions } : m
            )
          );
          break;
        }
        case "status": {
          setRoomStatus(data.status);
          break;
        }
        case "mute": {
          setMutedUserIds((prev) =>
            prev.includes(data.userId) ? prev : [...prev, data.userId]
          );
          break;
        }
        case "unmute": {
          setMutedUserIds((prev) => prev.filter((id) => id !== data.userId));
          break;
        }
        case "nsfw-update": {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.id ? { ...m, isNsfw: data.isNsfw } : m
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

  // -------------------------------------------------------------------------
  // @mention detection
  // -------------------------------------------------------------------------

  const detectMention = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const text = el.value;
    const cursor = el.selectionStart;
    const before = text.slice(0, cursor);
    const match = before.match(/(?:^|[\s])@([\w]*)$/);

    if (match) {
      const query = match[1];
      setMentionQuery(query);
      setMentionIndex(0);

      clearTimeout(mentionTimerRef.current);
      mentionTimerRef.current = setTimeout(async () => {
        if (query.length >= 1) {
          const results = await searchChatRoomUsers(query);
          setMentionResults(results);
        } else {
          setMentionResults([]);
        }
      }, 200);
    } else {
      setMentionQuery(null);
      setMentionResults([]);
    }
  }, []);

  const insertMention = useCallback(
    (user: MentionResult) => {
      const el = textareaRef.current;
      if (!el) return;
      const text = el.value;
      const cursor = el.selectionStart;
      const before = text.slice(0, cursor);
      const after = text.slice(cursor);
      const triggerIdx = before.lastIndexOf("@");
      if (triggerIdx === -1) return;

      const newValue = before.slice(0, triggerIdx) + `@${user.username} ` + after;
      setInputValue(newValue);
      setMentionQuery(null);
      setMentionResults([]);

      setTimeout(() => {
        el.focus();
        const newCursor = triggerIdx + (user.username?.length ?? 0) + 2;
        el.setSelectionRange(newCursor, newCursor);
      }, 0);
    },
    []
  );

  const handleMentionKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (mentionQuery === null || mentionResults.length === 0) return false;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionResults.length);
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length);
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionResults[mentionIndex]);
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        setMentionResults([]);
        return true;
      }
      return false;
    },
    [mentionQuery, mentionResults, mentionIndex, insertMention]
  );

  // -------------------------------------------------------------------------
  // Send
  // -------------------------------------------------------------------------

  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if ((!trimmed && !uploadPreview) || isSending) return;

    setIsSending(true);
    setInputValue("");
    const reply = replyingTo;
    setReplyingTo(null);
    const media = uploadPreview;
    const nsfw = uploadIsNsfw;
    setUploadPreview(null);
    setUploadIsNsfw(false);

    const result = await sendChatRoomMessage(trimmed, room, {
      replyToId: reply?.id,
      mediaUrl: media?.url,
      mediaType: media?.fileType,
      mediaFileName: media?.fileName,
      mediaFileSize: media?.fileSize,
      isNsfw: nsfw,
    });
    if (!result.success) {
      setInputValue(trimmed);
      setReplyingTo(reply);
      setUploadPreview(media);
      setUploadIsNsfw(nsfw);
    }
    setIsSending(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (handleMentionKeyDown(e)) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "ArrowUp" && !inputValue) {
      const lastOwn = [...messages].reverse().find(
        (m) => m.senderId === currentUserId && !m.deletedAt
      );
      if (lastOwn) {
        e.preventDefault();
        setEditingId(lastOwn.id);
        setEditValue(lastOwn.content);
      }
    }
  };

  // -------------------------------------------------------------------------
  // Edit / Delete
  // -------------------------------------------------------------------------

  const handleEdit = async (messageId: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    await editChatRoomMessage(messageId, trimmed);
    setEditingId(null);
    setEditValue("");
  };

  const handleDelete = async (messageId: string) => {
    await deleteChatRoomMessage(messageId);
  };

  // -------------------------------------------------------------------------
  // Reactions
  // -------------------------------------------------------------------------

  const handleReaction = async (messageId: string, emoji: string) => {
    setEmojiPickerMsgId(null);
    await toggleReaction(messageId, emoji);
  };

  // -------------------------------------------------------------------------
  // File upload — stage locally, send with message
  // -------------------------------------------------------------------------

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url, fileType, fileName, fileSize } = await res.json();
      setUploadPreview({ url, fileType, fileName, fileSize });
      setUploadIsNsfw(false);
    } catch {
      // Could show toast
    }
    setUploading(false);
  };

  // -------------------------------------------------------------------------
  // Giphy
  // -------------------------------------------------------------------------

  const handleGifSelect = async (gif: { images: { original: { url: string } } }) => {
    setShowGifPicker(false);
    const url = gif.images.original.url;
    await sendChatRoomMessage("", room, {
      mediaUrl: url,
      mediaType: "gif",
      mediaFileName: "giphy.gif",
      mediaFileSize: 0,
      replyToId: replyingTo?.id,
    });
    setReplyingTo(null);
  };

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  const handleSetStatus = async () => {
    await setChatRoomStatus(room, statusDraft);
    setEditingStatus(false);
  };

  // -------------------------------------------------------------------------
  // Mod actions
  // -------------------------------------------------------------------------

  const handleMute = async (userId: string, minutes?: number) => {
    setShowModMenu(null);
    await muteUser(room, userId, minutes);
  };

  const handleUnmute = async (userId: string) => {
    setShowModMenu(null);
    await unmuteUser(room, userId);
  };

  const handleToggleMod = async (userId: string) => {
    setShowModMenu(null);
    if (moderatorIds.includes(userId)) {
      await removeModerator(room, userId);
      setModeratorIds((prev) => prev.filter((id) => id !== userId));
    } else {
      await addModerator(room, userId);
      setModeratorIds((prev) => [...prev, userId]);
    }
  };

  // Scroll to a replied message
  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-yellow-50", "dark:bg-yellow-900/20");
      setTimeout(() => {
        el.classList.remove("bg-yellow-50", "dark:bg-yellow-900/20");
      }, 1500);
    }
  }, []);

  // Render mention-highlighted text
  const renderContent = useMemo(
    () => (text: string) => {
      const parts = text.split(/(@[a-zA-Z0-9_]{3,30})/g);
      return parts.map((part, i) =>
        part.startsWith("@") ? (
          <Link
            key={i}
            href={`/${part.slice(1)}`}
            className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            {part}
          </Link>
        ) : (
          <span key={i}>{part}</span>
        )
      );
    },
    []
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row md:gap-4">
      {/* Main chat area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="mb-1 flex items-center gap-2 md:mb-3 md:gap-3">
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-600 md:flex">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Chat Room</h1>
            {editingStatus ? (
              <div className="flex items-center gap-2">
                <input
                  value={statusDraft}
                  onChange={(e) => setStatusDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSetStatus();
                    if (e.key === "Escape") setEditingStatus(false);
                  }}
                  placeholder="Set a status..."
                  maxLength={200}
                  className="w-full max-w-xs rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  autoFocus
                />
                <button onClick={handleSetStatus} className="text-xs font-medium text-indigo-600 hover:text-indigo-500">Save</button>
                <button onClick={() => setEditingStatus(false)} className="text-xs text-zinc-400 hover:text-zinc-600">Cancel</button>
              </div>
            ) : (
              <p
                className={`text-xs ${isMod ? "cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300" : ""} text-zinc-500 dark:text-zinc-400`}
                onClick={isMod ? () => { setEditingStatus(true); setStatusDraft(roomStatus || ""); } : undefined}
                title={isMod ? "Click to edit status" : undefined}
              >
                {roomStatus || "Public lounge \u2014 everyone can chat here"}
                {isMod && !roomStatus && (
                  <span className="ml-1 text-zinc-400">(click to set status)</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Mobile online users — horizontal strip */}
        <div className="mb-1 md:hidden">
          <div className="flex items-center gap-2 overflow-x-auto rounded-lg bg-white px-2 py-1.5 shadow-sm dark:bg-zinc-900">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Online {onlineUsers.length}
            </span>
            {onlineUsers.map((user) => {
              const name = user.displayName || user.name || user.username || "?";
              return (
                <Link
                  key={user.id}
                  href={`/${user.username}`}
                  className="relative shrink-0"
                  title={name}
                >
                  <FramedAvatar
                    src={user.avatar || user.image}
                    initial={name[0]?.toUpperCase()}
                    size={28}
                    frameId={user.profileFrameId}
                  />
                  <div className="absolute -bottom-0.5 -right-0.5">
                    <PresenceIndicator isOnline={true} size="sm" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Chat container */}
        <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white p-2 shadow-sm md:p-4 dark:bg-zinc-900">
        {/* Messages area */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                No messages yet. Be the first to say something!
              </p>
            </div>
          ) : (
            <div className="space-y-1 md:space-y-3">
              {messages.map((msg) => {
                const isOwn = msg.senderId === currentUserId;
                const isDeleted = !!msg.deletedAt;
                const senderName =
                  msg.sender.displayName || msg.sender.name || msg.sender.username || "?";
                const avatarSrc = msg.sender.avatar || msg.sender.image;
                const initial = senderName[0]?.toUpperCase();
                const senderIsOwner = msg.senderId === initialMeta.ownerId;
                const senderIsMod = senderIsOwner || moderatorIds.includes(msg.senderId);
                const hasNsfwMedia = msg.isNsfw && msg.mediaUrl && !revealedNsfw.has(msg.id);

                return (
                  <div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    className="group rounded-lg p-1 transition-colors md:p-2"
                  >
                    {/* Reply quote */}
                    {msg.replyTo && (
                      <button
                        onClick={() => scrollToMessage(msg.replyTo!.id)}
                        className="mb-1 ml-11 flex items-center gap-1.5 rounded border-l-2 border-indigo-400 bg-zinc-50 px-2 py-1 text-left text-xs text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                      >
                        <svg className="h-3 w-3 shrink-0 rotate-180" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        <span className="font-medium">
                          {msg.replyTo.sender.displayName || msg.replyTo.sender.name || msg.replyTo.sender.username}
                        </span>
                        <span className="line-clamp-1">
                          {msg.replyTo.deletedAt ? "Message deleted" : msg.replyTo.content}
                        </span>
                      </button>
                    )}

                    <div className="flex gap-2 md:gap-3">
                      <Link href={`/${msg.sender.username}`} className="shrink-0 max-md:hidden">
                        <FramedAvatar
                          src={avatarSrc}
                          initial={initial}
                          size={36}
                          frameId={msg.sender.profileFrameId}
                          referrerPolicy="no-referrer"
                        />
                      </Link>
                      <Link href={`/${msg.sender.username}`} className="shrink-0 md:hidden">
                        <FramedAvatar
                          src={avatarSrc}
                          initial={initial}
                          size={24}
                          frameId={msg.sender.profileFrameId}
                          referrerPolicy="no-referrer"
                        />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/${msg.sender.username}`}
                            className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
                          >
                            <StyledName fontId={msg.sender.usernameFont}>
                              {senderName}
                            </StyledName>
                          </Link>
                          {senderIsOwner && <OwnerIcon />}
                          {!senderIsOwner && senderIsMod && <ModIcon />}
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
                                if (e.key === "Escape") setEditingId(null);
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
                          <>
                            {/* Message content */}
                            {msg.content && (
                              <p className="whitespace-pre-wrap break-words text-sm text-zinc-700 dark:text-zinc-300">
                                {renderContent(msg.content)}
                              </p>
                            )}

                            {/* Media */}
                            {msg.mediaUrl && (
                              <div className="mt-2">
                                {(msg.mediaType === "image" || msg.mediaType === "gif") ? (
                                  <div className="relative inline-block">
                                    {/* NSFW pill badge */}
                                    {msg.isNsfw && (
                                      <span className="absolute left-2 top-2 z-10 rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                                        NSFW
                                      </span>
                                    )}
                                    {hasNsfwMedia ? (
                                      <button
                                        onClick={() =>
                                          setRevealedNsfw((prev) => new Set(prev).add(msg.id))
                                        }
                                        className="relative overflow-hidden rounded-lg"
                                      >
                                        <img
                                          src={msg.mediaUrl}
                                          alt={msg.mediaFileName || "Image"}
                                          className="max-h-64 max-w-xs rounded-lg blur-2xl brightness-75"
                                          loading="lazy"
                                        />
                                        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-black/40">
                                          <p className="text-sm font-medium text-white">
                                            NSFW Content
                                          </p>
                                          <p className="mt-1 text-xs text-white/70">
                                            Click to reveal
                                          </p>
                                        </div>
                                      </button>
                                    ) : (
                                      <img
                                        src={msg.mediaUrl}
                                        alt={msg.mediaFileName || "Image"}
                                        className="max-h-64 max-w-xs rounded-lg"
                                        loading="lazy"
                                      />
                                    )}
                                  </div>
                                ) : msg.mediaType === "video" ? (
                                  <video
                                    src={msg.mediaUrl}
                                    controls
                                    className="max-h-64 max-w-xs rounded-lg"
                                  />
                                ) : (
                                  <a
                                    href={msg.mediaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                                    </svg>
                                    {msg.mediaFileName || "File"}
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Reactions */}
                            {msg.reactions.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {msg.reactions.map((r) => (
                                  <button
                                    key={r.emoji}
                                    onClick={() => handleReaction(msg.id, r.emoji)}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                                      r.userIds.includes(currentUserId)
                                        ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                                        : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                                    }`}
                                  >
                                    <span>{r.emoji}</span>
                                    <span>{r.userIds.length}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Action buttons */}
                      {!isDeleted && editingId !== msg.id && (
                        <div className="flex shrink-0 items-start gap-0.5">
                          {/* Reply */}
                          <button
                            onClick={() => {
                              setReplyingTo(msg);
                              textareaRef.current?.focus();
                            }}
                            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                            title="Reply"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                          </button>

                          {/* Emoji reaction */}
                          <button
                            onClick={() =>
                              setEmojiPickerMsgId(
                                emojiPickerMsgId === msg.id ? null : msg.id
                              )
                            }
                            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                            title="React"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                            </svg>
                          </button>

                          {/* Edit (own messages only) */}
                          {isOwn && (
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
                          )}

                          {/* Delete (own or mod) */}
                          {(isOwn || isMod) && (
                            <button
                              onClick={() => handleDelete(msg.id)}
                              className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                              title="Delete"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          )}

                          {/* Mod menu trigger for other users */}
                          {isMod && !isOwn && (
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setShowModMenu(showModMenu === msg.id ? null : msg.id)
                                }
                                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                                title="Mod actions"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </button>

                              {showModMenu === msg.id && (
                                <div className="absolute right-0 top-8 z-50 min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                                  {mutedUserIds.includes(msg.senderId) ? (
                                    <button
                                      onClick={() => handleUnmute(msg.senderId)}
                                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                    >
                                      Unmute user
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleMute(msg.senderId, 5)}
                                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                      >
                                        Mute 5 min
                                      </button>
                                      <button
                                        onClick={() => handleMute(msg.senderId, 60)}
                                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                      >
                                        Mute 1 hour
                                      </button>
                                      <button
                                        onClick={() => handleMute(msg.senderId)}
                                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-zinc-100 dark:text-red-400 dark:hover:bg-zinc-700"
                                      >
                                        Mute indefinitely
                                      </button>
                                    </>
                                  )}
                                  {isOwner && (
                                    <>
                                      <hr className="my-1 border-zinc-200 dark:border-zinc-700" />
                                      <button
                                        onClick={() => handleToggleMod(msg.senderId)}
                                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                      >
                                        {moderatorIds.includes(msg.senderId)
                                          ? "Remove moderator"
                                          : "Make moderator"}
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Emoji picker for this message */}
                    {emojiPickerMsgId === msg.id && (
                      <div className="ml-11 mt-2">
                        <EmojiPicker
                          onEmojiClick={(emojiData: { emoji: string }) =>
                            handleReaction(msg.id, emojiData.emoji)
                          }
                          width={300}
                          height={350}
                          searchPlaceholder="Search emoji..."
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Reply preview */}
        {replyingTo && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
            <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Replying to{" "}
                {replyingTo.sender.displayName ||
                  replyingTo.sender.name ||
                  replyingTo.sender.username}
              </p>
              <p className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
                {replyingTo.content || (replyingTo.mediaUrl ? "[media]" : "")}
              </p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="shrink-0 rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Upload preview with NSFW checkbox */}
        {uploadPreview && (
          <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
            <div className="flex items-start gap-3">
              {(uploadPreview.fileType === "image" || uploadPreview.fileType === "gif") ? (
                <img
                  src={uploadPreview.url}
                  alt={uploadPreview.fileName}
                  className="h-16 w-16 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-700">
                  <svg className="h-6 w-6 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {uploadPreview.fileName}
                </p>
                {(uploadPreview.fileType === "image" || uploadPreview.fileType === "gif") && (
                  <div className="mt-2">
                    <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                      <input
                        type="checkbox"
                        checked={uploadIsNsfw}
                        onChange={(e) => setUploadIsNsfw(e.target.checked)}
                        className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      NSFW
                    </label>
                    <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>No graphic/explicit or sensitive posts allowed.</span>
                      <button
                        type="button"
                        onClick={() => setShowContentFlagsInfo(true)}
                        className="inline-flex items-center justify-center rounded-full border border-zinc-300 text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-600 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
                        style={{ width: 16, height: 16, fontSize: 10, lineHeight: 1 }}
                        title="What do Sensitive and Graphic/Explicit mean?"
                      >
                        i
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => { setUploadPreview(null); setUploadIsNsfw(false); }}
                className="shrink-0 rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Muted notice */}
        {isMuted && (
          <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            You are muted in this chat room
          </div>
        )}

        {/* Input area */}
        {!isMuted && (
          <div className="relative mt-2">
            {/* @mention dropdown */}
            {mentionQuery !== null && mentionResults.length > 0 && (
              <div
                ref={mentionDropdownRef}
                className="absolute bottom-full left-0 z-50 mb-1 max-h-52 w-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
              >
                {mentionResults.map((user, i) => (
                  <button
                    key={user.id}
                    onClick={() => insertMention(user)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                      i === mentionIndex
                        ? "bg-zinc-100 dark:bg-zinc-700"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                    }`}
                  >
                    <FramedAvatar
                      src={user.avatar || user.image}
                      initial={(user.displayName || user.name || user.username || "?")[0]?.toUpperCase()}
                      size={24}
                      frameId={user.profileFrameId}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                        <StyledName fontId={user.usernameFont}>
                          {user.displayName || user.name || user.username}
                        </StyledName>
                      </p>
                      {user.username && (
                        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                          @{user.username}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {/* File upload (hidden input) */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Textarea row with send button on desktop */}
              <div className="flex items-end gap-2">
                {/* Desktop-only: image & GIF buttons inline */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="hidden rounded-lg p-2.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50 md:block dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  title="Upload image or video"
                >
                  {uploading ? (
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => setShowGifPicker(true)}
                  className="hidden rounded-lg p-2.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 md:block dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  title="Send a GIF"
                >
                  <span className="text-xs font-bold">GIF</span>
                </button>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    detectMention();
                  }}
                  onKeyDown={handleKeyDown}
                  onKeyUp={detectMention}
                  onClick={detectMention}
                  placeholder="Type a message..."
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
                />

                {/* Desktop send */}
                <button
                  onClick={handleSend}
                  disabled={(!inputValue.trim() && !uploadPreview) || isSending}
                  className="hidden rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50 md:block"
                >
                  {isSending ? "..." : "Send"}
                </button>
              </div>

              {/* Mobile-only: action buttons below textarea */}
              <div className="flex items-center gap-2 md:hidden">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  title="Upload image or video"
                >
                  {uploading ? (
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => setShowGifPicker(true)}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  title="Send a GIF"
                >
                  <span className="text-xs font-bold">GIF</span>
                </button>
                <div className="flex-1" />
                <button
                  onClick={handleSend}
                  disabled={(!inputValue.trim() && !uploadPreview) || isSending}
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50"
                >
                  {isSending ? "..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* GIF picker modal */}
        {showGifPicker && (
          <GifSearchModal
            onSelect={handleGifSelect}
            onClose={() => setShowGifPicker(false)}
          />
        )}

        {/* Content flags info modal */}
        {showContentFlagsInfo && (
          <ContentFlagsInfoModal onClose={() => setShowContentFlagsInfo(false)} />
        )}
      </div>

      {/* Online Users Sidebar */}
      <div className="hidden w-52 shrink-0 flex-col md:flex">
        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-zinc-900">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Online &mdash; {onlineUsers.length}
          </h2>
          <div className="max-h-[calc(100dvh-12rem)] space-y-1.5 overflow-y-auto">
            {onlineUsers.map((user) => {
              const name = user.displayName || user.name || user.username || "?";
              const userIsOwner = user.id === initialMeta.ownerId;
              const userIsMod = userIsOwner || moderatorIds.includes(user.id);

              return (
                <Link
                  key={user.id}
                  href={`/${user.username}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <div className="relative shrink-0">
                    <FramedAvatar
                      src={user.avatar || user.image}
                      initial={name[0]?.toUpperCase()}
                      size={24}
                      frameId={user.profileFrameId}
                    />
                    <div className="absolute -bottom-0.5 -right-0.5">
                      <PresenceIndicator isOnline={true} size="sm" />
                    </div>
                  </div>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    <StyledName fontId={user.usernameFont}>
                      {name}
                    </StyledName>
                  </span>
                  {userIsOwner && (
                    <OwnerIcon />
                  )}
                  {!userIsOwner && userIsMod && (
                    <ModIcon />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
