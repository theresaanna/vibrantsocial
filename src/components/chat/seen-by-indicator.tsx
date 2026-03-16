"use client";

import { useState, useEffect, useRef } from "react";
import { FramedAvatar } from "@/components/framed-avatar";
import type { ChatUserProfile } from "@/types/chat";

interface SeenByIndicatorProps {
  seenBy: ChatUserProfile[];
}

const MAX_AVATARS = 3;

function getDisplayName(user: ChatUserProfile): string {
  return user.displayName ?? user.username ?? user.name ?? "User";
}

export function SeenByIndicator({ seenBy }: SeenByIndicatorProps) {
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPopover) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setShowPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPopover]);

  if (seenBy.length === 0) return null;

  const visible = seenBy.slice(0, MAX_AVATARS);
  const overflow = seenBy.length - MAX_AVATARS;
  const ariaLabel = `Seen by ${seenBy.map(getDisplayName).join(", ")}`;

  return (
    <div className="relative flex items-center justify-end gap-0.5 px-1 pt-0.5" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setShowPopover(!showPopover)}
        className="flex items-center -space-x-1 rounded-full p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        aria-label={ariaLabel}
      >
        {visible.map((user) => {
          const avatar = user.avatar ?? user.image;
          const name = getDisplayName(user);
          return (
            <FramedAvatar
              key={user.id}
              src={avatar}
              alt={name}
              initial={name[0]?.toUpperCase()}
              size={16}
              frameId={user.profileFrameId}
              className="border border-white dark:border-zinc-900"
            />
          );
        })}
        {overflow > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-white bg-zinc-200 text-[8px] font-medium text-zinc-500 dark:border-zinc-900 dark:bg-zinc-700 dark:text-zinc-400">
            +{overflow}
          </span>
        )}
      </button>

      {showPopover && (
        <div className="absolute bottom-full right-0 z-20 mb-1 w-max max-w-[200px] rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Seen by
          </p>
          {seenBy.map((user) => (
            <p
              key={user.id}
              className="truncate text-xs text-zinc-700 dark:text-zinc-300"
            >
              {getDisplayName(user)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
