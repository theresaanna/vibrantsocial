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
import { $isImageNode } from "./ImageNode";
import { ImageSidebar } from "./ImageSidebar";
import { ImageResizeModal } from "./ImageResizeModal";
import { ImageAltTextModal } from "./ImageAltTextModal";
import { ImageOverlay } from "@/components/image-overlay";
import { useIsPostAuthor } from "../PostAuthorContext";
import { DRAG_NODE_KEY_ATTR } from "../plugins/DragDropPlugin";

const MAX_DISPLAY_PX = 1000;

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
  // In display mode (viewing a posted post), images should not be interactive
  // even when the editor is editable (for checklist toggling)
  const isDisplayMode = useIsPostAuthor();
  const isImageEditable = editor.isEditable() && !isDisplayMode;

  const [imgAltText, setImgAltText] = useState(altText);

  // Modal state
  const [showResizeModal, setShowResizeModal] = useState(false);
  const [showAltTextModal, setShowAltTextModal] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

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
    // Don't register interactive commands in display mode
    if (isDisplayMode) return;
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
  }, [clearSelection, editor, isDisplayMode, isSelected, nodeKey, onDelete, setSelected]);

  const handleResizeStart = useCallback(
    (direction: ResizeDirection) => (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);

      const startX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const startWidth =
        typeof imgSize.width === "number" ? imgSize.width : imgRef.current?.naturalWidth ?? 300;

      const xMultiplier = direction === "sw" || direction === "nw" ? -1 : 1;

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

  const handleAltTextApply = useCallback(
    (newAltText: string) => {
      setImgAltText(newAltText);
      setShowAltTextModal(false);
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
      setShowResizeModal(false);
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
  if (!isImageEditable) {
    style.maxWidth = `${MAX_DISPLAY_PX}px`;
    style.maxHeight = `${MAX_DISPLAY_PX}px`;
    style.cursor = "zoom-in";
  }

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

  const getEditorWidth = () => {
    const editorEl = editor.getRootElement();
    return editorEl?.clientWidth ?? 600;
  };

  return (
    <span
      className={`relative inline-block ${isSelected && isImageEditable ? "ring-2 ring-blue-500" : ""}`}
      {...(isImageEditable ? { [DRAG_NODE_KEY_ATTR]: nodeKey } : {})}
    >
      <img
        ref={imgRef}
        src={src}
        alt={imgAltText}
        style={style}
        className={`max-w-full rounded${isImageEditable ? " cursor-grab active:cursor-grabbing" : ""}`}
        draggable={isImageEditable}
        onClick={!isImageEditable ? () => setShowOverlay(true) : undefined}
        data-testid="editor-image"
      />
      {isSelected && isImageEditable && (
        <>
          {/* Resize handles — larger on touch devices */}
          <span
            className={
              isTouchDevice
                ? "absolute -right-3 -bottom-3 h-8 w-8 cursor-se-resize rounded-full bg-blue-500/50"
                : "absolute -right-2 -bottom-2 h-4 w-4 cursor-se-resize rounded-full bg-blue-500"
            }
            style={{ touchAction: "none" }}
            onMouseDown={handleResizeStart("se")}
            onTouchStart={handleResizeStart("se")}
            data-testid="resize-handle-se"
          />
          <span
            className={
              isTouchDevice
                ? "absolute -left-3 -bottom-3 h-8 w-8 cursor-sw-resize rounded-full bg-blue-500/50"
                : "absolute -left-2 -bottom-2 h-4 w-4 cursor-sw-resize rounded-full bg-blue-500"
            }
            style={{ touchAction: "none" }}
            onMouseDown={handleResizeStart("sw")}
            onTouchStart={handleResizeStart("sw")}
            data-testid="resize-handle-sw"
          />
          <span
            className={
              isTouchDevice
                ? "absolute -right-3 -top-3 h-8 w-8 cursor-ne-resize rounded-full bg-blue-500/50"
                : "absolute -right-2 -top-2 h-4 w-4 cursor-ne-resize rounded-full bg-blue-500"
            }
            style={{ touchAction: "none" }}
            onMouseDown={handleResizeStart("ne")}
            onTouchStart={handleResizeStart("ne")}
            data-testid="resize-handle-ne"
          />
          <span
            className={
              isTouchDevice
                ? "absolute -left-3 -top-3 h-8 w-8 cursor-nw-resize rounded-full bg-blue-500/50"
                : "absolute -left-2 -top-2 h-4 w-4 cursor-nw-resize rounded-full bg-blue-500"
            }
            style={{ touchAction: "none" }}
            onMouseDown={handleResizeStart("nw")}
            onTouchStart={handleResizeStart("nw")}
            data-testid="resize-handle-nw"
          />

          {/* Sidebar with action buttons */}
          <ImageSidebar
            isTouchDevice={isTouchDevice}
            onResizeClick={() => setShowResizeModal(true)}
            onAltTextClick={() => setShowAltTextModal(true)}
          />
        </>
      )}

      {/* Resize modal */}
      {showResizeModal && (() => {
        const dims = getRenderedDimensions();
        return (
          <ImageResizeModal
            initialWidth={dims.w}
            initialHeight={dims.h}
            naturalWidth={dims.nw}
            naturalHeight={dims.nh}
            editorWidth={getEditorWidth()}
            onApply={handleResizeApply}
            onClose={() => setShowResizeModal(false)}
          />
        );
      })()}

      {/* Alt text modal */}
      {showAltTextModal && (
        <ImageAltTextModal
          initialAltText={imgAltText}
          onApply={handleAltTextApply}
          onClose={() => setShowAltTextModal(false)}
        />
      )}

      {/* Full-size overlay */}
      {showOverlay && (
        <ImageOverlay
          src={src}
          alt={imgAltText}
          onClose={() => setShowOverlay(false)}
        />
      )}
    </span>
  );
}
