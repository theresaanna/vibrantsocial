"use client";

import { createPortal } from "react-dom";
import { FramedAvatar } from "@/components/framed-avatar";
import type { ChatUserProfile } from "@/types/chat";
import type { TypeaheadMode, TagResult } from "@/hooks/use-typeahead";

interface TypeaheadDropdownProps {
  mode: TypeaheadMode;
  mentionResults: ChatUserProfile[];
  tagResults: TagResult[];
  selectedIndex: number;
  dropdownPos: { top: number; left: number } | null;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  insertMention: (user: ChatUserProfile) => void;
  insertHashtag: (tag: TagResult) => void;
}

export function TypeaheadDropdown({
  mode,
  mentionResults,
  tagResults,
  selectedIndex,
  dropdownPos,
  dropdownRef,
  insertMention,
  insertHashtag,
}: TypeaheadDropdownProps) {
  if (!dropdownPos) return null;

  const resultsCount =
    mode === "mention" ? mentionResults.length : tagResults.length;
  if (resultsCount === 0) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      className="max-h-52 w-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
      style={{
        position: "absolute",
        top: dropdownPos.top,
        left: dropdownPos.left,
        zIndex: 9999,
      }}
      role="listbox"
      aria-label={
        mode === "mention" ? "Mention suggestions" : "Tag suggestions"
      }
      data-testid="typeahead-dropdown"
    >
      {mode === "mention" &&
        mentionResults.map((user, index) => {
          const avatarSrc = user.avatar || user.image;
          const displayName =
            user.displayName || user.name || user.username || "User";
          return (
            <button
              key={user.id}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => insertMention(user)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                index === selectedIndex
                  ? "bg-zinc-100 dark:bg-zinc-700"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
              }`}
              data-testid={`mention-option-${user.username}`}
            >
              <FramedAvatar
                src={avatarSrc}
                alt=""
                initial={displayName[0]?.toUpperCase()}
                size={32}
                frameId={user.profileFrameId}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                  {displayName}
                </div>
                {user.username && (
                  <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    @{user.username}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      {mode === "hashtag" &&
        tagResults.map((tag, index) => (
          <button
            key={tag.id}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => insertHashtag(tag)}
            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
              index === selectedIndex
                ? "bg-zinc-100 dark:bg-zinc-700"
                : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
            }`}
            data-testid={`tag-option-${tag.name}`}
          >
            <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
              #{tag.name}
            </span>
            <span className="ml-2 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
              {tag.count} {tag.count === 1 ? "post" : "posts"}
            </span>
          </button>
        ))}
    </div>,
    document.body
  );
}
