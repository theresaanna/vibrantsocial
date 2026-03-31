"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface VideoSidebarProps {
  isTouchDevice: boolean;
  onResizeClick: () => void;
}

export function VideoSidebar({
  isTouchDevice,
  onResizeClick,
}: VideoSidebarProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const buttonClass =
    "flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:active:bg-zinc-600 transition-colors";

  return createPortal(
    <div
      ref={ref}
      data-testid="video-sidebar"
      className={`fixed top-1/2 right-0 z-[90] flex -translate-y-1/2 flex-col gap-2 rounded-l-xl border border-r-0 border-zinc-200 bg-white p-2 shadow-lg transition-transform duration-200 ease-out dark:border-zinc-700 dark:bg-zinc-900 ${
        visible ? "translate-x-0" : "translate-x-full"
      }`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onResizeClick}
        title="Resize video"
        data-testid="sidebar-resize-button"
        className={buttonClass}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
      </button>
    </div>,
    document.body,
  );
}
