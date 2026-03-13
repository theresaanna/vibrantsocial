"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { mergeRegister } from "@lexical/utils";
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  type NodeKey,
} from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { $isImageNode } from "./ImageNode";

type ResizeDirection = "se" | "sw" | "ne" | "nw";

interface ImageComponentProps {
  src: string;
  altText: string;
  width: number | "inherit";
  height: number | "inherit";
  nodeKey: NodeKey;
}

/* ------------------------------------------------------------------ */
/*  Resize Popover                                                     */
/* ------------------------------------------------------------------ */

function ResizePopover({
  initialWidth,
  initialHeight,
  naturalWidth,
  naturalHeight,
  onApply,
  onClose,
  anchorRect,
}: {
  initialWidth: number;
  initialHeight: number;
  naturalWidth: number;
  naturalHeight: number;
  onApply: (w: number, h: number) => void;
  onClose: () => void;
  anchorRect: DOMRect;
}) {
  const [w, setW] = useState(initialWidth);
  const [h, setH] = useState(initialHeight);
  const [locked, setLocked] = useState(true);
  const aspectRatio = naturalWidth / naturalHeight;
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const handleWidthChange = (val: number) => {
    const clamped = Math.max(10, val);
    setW(clamped);
    if (locked) setH(Math.round(clamped / aspectRatio));
  };

  const handleHeightChange = (val: number) => {
    const clamped = Math.max(10, val);
    setH(clamped);
    if (locked) setW(Math.round(clamped * aspectRatio));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply(w, h);
  };

  // Center over the image
  const top = anchorRect.top + anchorRect.height / 2;
  const left = anchorRect.left + anchorRect.width / 2;

  return createPortal(
    <div
      ref={popoverRef}
      data-testid="image-resize-popover"
      className="fixed z-[200] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
      style={{ top, left }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          Width
          <input
            type="number"
            min={10}
            value={w}
            onChange={(e) => handleWidthChange(Number(e.target.value))}
            data-testid="resize-width-input"
            className="w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          />
        </label>

        <button
          type="button"
          onClick={() => setLocked(!locked)}
          data-testid="resize-aspect-lock"
          title={locked ? "Unlock aspect ratio" : "Lock aspect ratio"}
          className={`mb-0.5 flex h-7 w-7 items-center justify-center rounded transition-colors ${
            locked
              ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
              : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
          }`}
        >
          {locked ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
          )}
        </button>

        <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          Height
          <input
            type="number"
            min={10}
            value={h}
            onChange={(e) => handleHeightChange(Number(e.target.value))}
            data-testid="resize-height-input"
            className="w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          />
        </label>

        <button
          type="submit"
          data-testid="resize-apply-button"
          className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
        >
          Apply
        </button>
      </form>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/*  Context Menu                                                       */
/* ------------------------------------------------------------------ */

function ImageContextMenu({
  x,
  y,
  onResize,
  onClose,
}: {
  x: number;
  y: number;
  onResize: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      data-testid="image-context-menu"
      className="fixed z-[200] min-w-[120px] rounded-lg border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
      style={{ top: y, left: x }}
    >
      <button
        type="button"
        onClick={onResize}
        data-testid="context-menu-resize"
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
        Resize
      </button>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/*  Main Image Component                                               */
/* ------------------------------------------------------------------ */

export default function ImageComponent({
  src,
  altText,
  width,
  height,
  nodeKey,
}: ImageComponentProps) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [imgSize, setImgSize] = useState({ width, height });

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  // Resize popover state
  const [showResizePopover, setShowResizePopover] = useState(false);

  const onDelete = useCallback(
    (event: KeyboardEvent) => {
      if (isSelected && $isNodeSelection($getSelection())) {
        event.preventDefault();
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isImageNode(node)) node.remove();
        });
        return true;
      }
      return false;
    },
    [editor, isSelected, nodeKey]
  );

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          if (imgRef.current && imgRef.current.contains(event.target as Node)) {
            if (!event.shiftKey) clearSelection();
            setSelected(!isSelected);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(KEY_DELETE_COMMAND, onDelete, COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_BACKSPACE_COMMAND, onDelete, COMMAND_PRIORITY_LOW)
    );
  }, [clearSelection, editor, isSelected, nodeKey, onDelete, setSelected]);

  const handleResizeStart = useCallback(
    (direction: ResizeDirection) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth =
        typeof imgSize.width === "number" ? imgSize.width : imgRef.current?.naturalWidth ?? 300;

      // Left-side handles invert the drag direction
      const xMultiplier = direction === "sw" || direction === "nw" ? -1 : 1;

      function onMouseMove(moveEvent: MouseEvent) {
        const newWidth = Math.max(100, startWidth + xMultiplier * (moveEvent.clientX - startX));
        setImgSize({ width: newWidth, height: "inherit" });
      }

      function onMouseUp() {
        setIsResizing(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isImageNode(node)) {
            const currentWidth =
              typeof imgSize.width === "number"
                ? imgSize.width
                : imgRef.current?.naturalWidth ?? 300;
            node.setWidthAndHeight(currentWidth, "inherit");
          }
        });
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [editor, imgSize.width, nodeKey]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!editor.isEditable()) return;
      e.preventDefault();
      e.stopPropagation();
      // Select the image
      if (!isSelected) {
        clearSelection();
        setSelected(true);
      }
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    [editor, isSelected, clearSelection, setSelected]
  );

  const openResizePopover = useCallback(() => {
    setContextMenu(null);
    setShowResizePopover(true);
  }, []);

  const handleResizeApply = useCallback(
    (newWidth: number, newHeight: number) => {
      setImgSize({ width: newWidth, height: newHeight });
      setShowResizePopover(false);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isImageNode(node)) {
          node.setWidthAndHeight(newWidth, newHeight);
        }
      });
    },
    [editor, nodeKey]
  );

  const style: React.CSSProperties = {};
  if (typeof imgSize.width === "number") style.width = `${imgSize.width}px`;
  if (typeof imgSize.height === "number") style.height = `${imgSize.height}px`;

  // Compute current rendered dimensions for the resize popover
  const getRenderedDimensions = () => {
    const img = imgRef.current;
    if (!img) return { w: 300, h: 200, nw: 300, nh: 200 };
    return {
      w: typeof imgSize.width === "number" ? imgSize.width : img.naturalWidth,
      h: typeof imgSize.height === "number" ? imgSize.height : img.naturalHeight,
      nw: img.naturalWidth || 300,
      nh: img.naturalHeight || 200,
    };
  };

  return (
    <span className={`relative inline-block ${isSelected ? "ring-2 ring-blue-500" : ""}`}>
      <img
        ref={imgRef}
        src={src}
        alt={altText}
        style={style}
        className="max-w-full rounded"
        draggable={false}
        onContextMenu={handleContextMenu}
      />
      {isSelected && editor.isEditable() && (
        <>
          <span
            className="absolute -right-1 -bottom-1 h-3 w-3 cursor-se-resize rounded-full bg-blue-500"
            onMouseDown={handleResizeStart("se")}
            data-testid="resize-handle-se"
          />
          <span
            className="absolute -left-1 -bottom-1 h-3 w-3 cursor-sw-resize rounded-full bg-blue-500"
            onMouseDown={handleResizeStart("sw")}
            data-testid="resize-handle-sw"
          />
          <span
            className="absolute -right-1 -top-1 h-3 w-3 cursor-ne-resize rounded-full bg-blue-500"
            onMouseDown={handleResizeStart("ne")}
            data-testid="resize-handle-ne"
          />
          <span
            className="absolute -left-1 -top-1 h-3 w-3 cursor-nw-resize rounded-full bg-blue-500"
            onMouseDown={handleResizeStart("nw")}
            data-testid="resize-handle-nw"
          />
        </>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <ImageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onResize={openResizePopover}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Resize popover */}
      {showResizePopover && imgRef.current && (() => {
        const dims = getRenderedDimensions();
        return (
          <ResizePopover
            initialWidth={dims.w}
            initialHeight={dims.h}
            naturalWidth={dims.nw}
            naturalHeight={dims.nh}
            onApply={handleResizeApply}
            onClose={() => setShowResizePopover(false)}
            anchorRect={imgRef.current!.getBoundingClientRect()}
          />
        );
      })()}
    </span>
  );
}
