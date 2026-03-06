"use client";

interface PresenceIndicatorProps {
  isOnline: boolean;
  size?: "sm" | "md";
}

export function PresenceIndicator({
  isOnline,
  size = "sm",
}: PresenceIndicatorProps) {
  const sizeClass = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";
  const colorClass = isOnline
    ? "bg-green-500"
    : "bg-zinc-300 dark:bg-zinc-600";

  return (
    <span
      className={`inline-block rounded-full ${sizeClass} ${colorClass}`}
      aria-label={isOnline ? "Online" : "Offline"}
    />
  );
}
