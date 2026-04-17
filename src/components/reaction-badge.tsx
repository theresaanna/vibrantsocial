"use client";

import { useState, useRef, useEffect } from "react";

interface ReactionBadgeProps {
  emoji: string;
  userIds: string[];
  userNames: string[];
  currentUserId?: string;
  isReacted: boolean;
  onClick: () => void;
  activeClassName: string;
  inactiveClassName: string;
  "data-testid"?: string;
}

function formatTooltip(userNames: string[], userIds: string[], currentUserId?: string): string {
  const names = userNames.map((name, i) =>
    currentUserId && userIds[i] === currentUserId ? "You" : name
  );
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length <= 5) {
    return names.slice(0, -1).join(", ") + ", and " + names[names.length - 1];
  }
  return names.slice(0, 4).join(", ") + `, and ${names.length - 4} more`;
}

export function ReactionBadge({
  emoji,
  userIds,
  userNames,
  currentUserId,
  isReacted,
  onClick,
  activeClassName,
  inactiveClassName,
  "data-testid": testId,
}: ReactionBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [nudgeLeft, setNudgeLeft] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showTooltip && tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      if (rect.right > window.innerWidth - 8) {
        setNudgeLeft(true);
      } else if (rect.left < 8) {
        setNudgeLeft(false);
      }
    }
  }, [showTooltip]);

  const tooltip = formatTooltip(userNames, userIds, currentUserId);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => { setShowTooltip(false); setNudgeLeft(false); }}
    >
      <button
        onClick={onClick}
        className={isReacted ? activeClassName : inactiveClassName}
        aria-label={`${emoji} ${userIds.length}`}
        data-testid={testId}
      >
        <span>{emoji}</span>
        <span>{userIds.length}</span>
      </button>
      {showTooltip && tooltip && (
        <div
          ref={tooltipRef}
          className={`absolute bottom-full mb-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-lg ${
            nudgeLeft ? "right-0" : "left-1/2 -translate-x-1/2"
          }`}
          style={{
            pointerEvents: "none",
            zIndex: 50,
            backgroundColor: "var(--profile-text, #18181b)",
            color: "var(--profile-container, #f4f4f5)",
          }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}
