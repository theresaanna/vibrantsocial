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

function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia === "function") {
      setIsTouch(window.matchMedia("(pointer: coarse)").matches);
    }
  }, []);
  return isTouch;
}

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
  const [w, setW] = useState(String(initialWidth));
  const [h, setH] = useState(String(initialHeight));
  const [locked, setLocked] = useState(true);
  const [error, setError] = useState("");
  const aspectRatio = naturalWidth / naturalHeight;
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const handleWidthChange = (val: string) => {
    setW(val);
    setError("");
    const num = Number(val);
    if (locked && val !== "" && Number.isFinite(num) && num > 0) {
      setH(String(Math.round(num / aspectRatio)));
    }
  };

  const handleHeightChange = (val: string) => {
    setH(val);
    setError("");
    const num = Number(val);
    if (locked && val !== "" && Number.isFinite(num) && num > 0) {
      setW(String(Math.round(num * aspectRatio)));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedW = Number(w);
    const parsedH = Number(h);
    if (w.trim() === "" || h.trim() === "" || !Number.isFinite(parsedW) || !Number.isFinite(parsedH) || parsedW !== Math.floor(parsedW) || parsedH !== Math.floor(parsedH) || parsedW < 1 || parsedH < 1) {
      setError("Width and height must be positive whole numbers.");
      return;
    }
    if (parsedW < 10 || parsedH < 10) {
      setError("Minimum size is 10 \u00d7 10 pixels.");
      return;
    }
    onApply(parsedW, parsedH);
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
      onTouchStart={(e) => e.stopPropagation()}
    >
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          Width
          <input
            type="text"
            inputMode="numeric"
            value={w}
            onChange={(e) => handleWidthChange(e.target.value)}
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
            type="text"
            inputMode="numeric"
            value={h}
            onChange={(e) => handleHeightChange(e.target.value)}
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
      {error && (
        <p data-testid="resize-error" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/*  Alt Text Popover                                                   */
/* ------------------------------------------------------------------ */

function AltTextPopover({
  initialAltText,
  onApply,
  onClose,
  anchorRect,
}: {
  initialAltText: string;
  onApply: (altText: string) => void;
  onClose: () => void;
  anchorRect: DOMRect;
}) {
  const [value, setValue] = useState(initialAltText);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply(value);
  };

  const top = anchorRect.top + anchorRect.height / 2;
  const left = anchorRect.left + anchorRect.width / 2;

  return createPortal(
    <div
      ref={popoverRef}
      data-testid="alt-text-popover"
      className="fixed z-[200] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
      style={{ top, left }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          Alt text
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            data-testid="alt-text-input"
            placeholder="Describe this image"
            className="w-56 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          />
        </label>

        <button
          type="submit"
          data-testid="alt-text-apply-button"
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
  onAltText,
  onClose,
}: {
  x: number;
  y: number;
  onResize: () => void;
  onAltText: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
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
      <button
        type="button"
        onClick={onAltText}
        data-testid="context-menu-alt-text"
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M4 6h16M4 12h10M4 18h14" />
        </svg>
        Alt text
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
  const isTouchDevice = useIsTouchDevice();

  const [imgAltText, setImgAltText] = useState(altText);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  // Popover state
  const [showResizePopover, setShowResizePopover] = useState(false);
  const [showAltTextPopover, setShowAltTextPopover] = useState(false);

  // Long-press timer for mobile context menu
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    (direction: ResizeDirection) => (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);

      const startX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const startWidth =
        typeof imgSize.width === "number" ? imgSize.width : imgRef.current?.naturalWidth ?? 300;

      // Left-side handles invert the drag direction
      const xMultiplier = direction === "sw" || direction === "nw" ? -1 : 1;

      // Track latest width in a mutable variable so cleanup reads the final value
      let latestWidth = startWidth;

      function onPointerMove(clientX: number) {
        latestWidth = Math.max(100, startWidth + xMultiplier * (clientX - startX));
        setImgSize({ width: latestWidth, height: "inherit" });
      }

      function onMouseMove(moveEvent: MouseEvent) {
        onPointerMove(moveEvent.clientX);
      }

      function onTouchMove(moveEvent: TouchEvent) {
        onPointerMove(moveEvent.touches[0].clientX);
      }

      function cleanup() {
        setIsResizing(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", cleanup);
        document.removeEventListener("touchmove", onTouchMove);
        document.removeEventListener("touchend", cleanup);
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isImageNode(node)) {
            node.setWidthAndHeight(latestWidth, "inherit");
          }
        });
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", cleanup);
      document.addEventListener("touchmove", onTouchMove);
      document.addEventListener("touchend", cleanup);
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

  // Long-press on image for mobile context menu
  const handleImageTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!editor.isEditable()) return;
      const touch = e.touches[0];
      const x = touch.clientX;
      const y = touch.clientY;
      longPressTimerRef.current = setTimeout(() => {
        if (!isSelected) {
          clearSelection();
          setSelected(true);
        }
        setContextMenu({ x, y });
        longPressTimerRef.current = null;
      }, 500);
    },
    [editor, isSelected, clearSelection, setSelected]
  );

  const handleImageTouchEnd = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleImageTouchMove = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const openResizePopover = useCallback(() => {
    setContextMenu(null);
    setShowResizePopover(true);
  }, []);

  const openAltTextPopover = useCallback(() => {
    setContextMenu(null);
    setShowAltTextPopover(true);
  }, []);

  const handleAltTextApply = useCallback(
    (newAltText: string) => {
      setImgAltText(newAltText);
      setShowAltTextPopover(false);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isImageNode(node)) {
          node.setAltText(newAltText);
        }
      });
    },
    [editor, nodeKey]
  );

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
        alt={imgAltText}
        style={style}
        className="max-w-full rounded"
        draggable={false}
        onContextMenu={handleContextMenu}
        onTouchStart={handleImageTouchStart}
        onTouchEnd={handleImageTouchEnd}
        onTouchMove={handleImageTouchMove}
      />
      {isSelected && editor.isEditable() && (
        <>
          {/* Action toolbar */}
          <div
            className="absolute -top-10 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-lg border border-zinc-200 bg-white p-1 shadow-md dark:border-zinc-700 dark:bg-zinc-800"
            data-testid="image-action-toolbar"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={openResizePopover}
              data-testid="toolbar-resize-button"
              title="Resize"
              className="flex h-7 w-7 items-center justify-center rounded text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={openAltTextPopover}
              data-testid="toolbar-alt-text-button"
              title="Alt text"
              className="flex h-7 w-7 items-center justify-center rounded text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M4 6h16M4 12h10M4 18h14" />
              </svg>
            </button>
          </div>

          {/* Resize handles */}
          <span
            className={isTouchDevice
              ? "absolute -right-4 -bottom-4 h-10 w-10 cursor-se-resize rounded-full bg-blue-500/50"
              : "absolute -right-1 -bottom-1 h-3 w-3 cursor-se-resize rounded-full bg-blue-500"
            }
            style={{ touchAction: "none" }}
            onMouseDown={handleResizeStart("se")}
            onTouchStart={handleResizeStart("se")}
            data-testid="resize-handle-se"
          />
          <span
            className={isTouchDevice
              ? "absolute -left-4 -bottom-4 h-10 w-10 cursor-sw-resize rounded-full bg-blue-500/50"
              : "absolute -left-1 -bottom-1 h-3 w-3 cursor-sw-resize rounded-full bg-blue-500"
            }
            style={{ touchAction: "none" }}
            onMouseDown={handleResizeStart("sw")}
            onTouchStart={handleResizeStart("sw")}
            data-testid="resize-handle-sw"
          />
          <span
            className={isTouchDevice
              ? "absolute -right-4 -top-4 h-10 w-10 cursor-ne-resize rounded-full bg-blue-500/50"
              : "absolute -right-1 -top-1 h-3 w-3 cursor-ne-resize rounded-full bg-blue-500"
            }
            style={{ touchAction: "none" }}
            onMouseDown={handleResizeStart("ne")}
            onTouchStart={handleResizeStart("ne")}
            data-testid="resize-handle-ne"
          />
          <span
            className={isTouchDevice
              ? "absolute -left-4 -top-4 h-10 w-10 cursor-nw-resize rounded-full bg-blue-500/50"
              : "absolute -left-1 -top-1 h-3 w-3 cursor-nw-resize rounded-full bg-blue-500"
            }
            style={{ touchAction: "none" }}
            onMouseDown={handleResizeStart("nw")}
            onTouchStart={handleResizeStart("nw")}
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
          onAltText={openAltTextPopover}
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

      {/* Alt text popover */}
      {showAltTextPopover && imgRef.current && (
        <AltTextPopover
          initialAltText={imgAltText}
          onApply={handleAltTextApply}
          onClose={() => setShowAltTextPopover(false)}
          anchorRect={imgRef.current.getBoundingClientRect()}
        />
      )}
    </span>
  );
}
