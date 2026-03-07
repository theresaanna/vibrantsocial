"use client";

import { useRef, useState, useEffect } from "react";
import { EditorContent } from "@/components/editor/EditorContent";

interface PostContentProps {
  content: string;
  truncate?: boolean;
}

export function PostContent({ content, truncate = true }: PostContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!truncate || expanded) return;

    const el = contentRef.current;
    if (el && el.scrollHeight > el.clientHeight) {
      setIsOverflowing(true);
    }
  }, [truncate, expanded, content]);

  const shouldTruncate = truncate && !expanded;

  return (
    <div className="relative">
      <div
        ref={contentRef}
        data-testid="post-content-container"
        className={shouldTruncate ? "max-h-[50vh] overflow-hidden" : ""}
      >
        <EditorContent content={content} />
      </div>
      {shouldTruncate && isOverflowing && (
        <>
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white dark:from-zinc-900" />
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              data-testid="show-more-button"
            >
              Show more
            </button>
          </div>
        </>
      )}
    </div>
  );
}
