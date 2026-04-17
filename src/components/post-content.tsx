"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { EditorContent } from "@/components/editor/EditorContent";
import { extractFirstUrl } from "@/lib/lexical-text";
import { LinkPreviewCard } from "@/components/link-preview-card";

interface PostContentProps {
  content: string;
  truncate?: boolean;
  allowChecklistToggle?: boolean;
  onContentChange?: (json: string) => void;
  isPostAuthor?: boolean;
  hideLinkPreview?: boolean;
  postId?: string;
  currentUserId?: string;
}

export function PostContent({ content, truncate = true, allowChecklistToggle, onContentChange, isPostAuthor, hideLinkPreview, postId, currentUserId }: PostContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const firstUrl = useMemo(() => extractFirstUrl(content), [content]);

  useEffect(() => {
    if (!truncate || expanded) return;

    const el = contentRef.current;
    if (!el) return;

    const check = () => {
      if (el.scrollHeight > el.clientHeight) {
        setIsOverflowing(true);
      }
    };

    check();

    // Re-check when images load and resize the content
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [truncate, expanded, content]);

  const shouldTruncate = truncate && !expanded;

  return (
    <div className="relative">
      <div
        ref={contentRef}
        data-testid="post-content-container"
        className={shouldTruncate ? "max-h-[50vh] overflow-hidden" : ""}
      >
        <EditorContent content={content} allowChecklistToggle={allowChecklistToggle} onContentChange={onContentChange} isPostAuthor={isPostAuthor} postId={postId} currentUserId={currentUserId} />
      </div>
      {shouldTruncate && isOverflowing && (
        <>
          <div className="post-truncation-gradient pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white dark:from-zinc-900" />
          <div className="relative flex justify-center pt-1">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="themed-action-btn rounded-full px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              data-testid="show-more-button"
            >
              Show more
            </button>
          </div>
        </>
      )}
      {firstUrl && !hideLinkPreview && <LinkPreviewCard url={firstUrl} />}
    </div>
  );
}
