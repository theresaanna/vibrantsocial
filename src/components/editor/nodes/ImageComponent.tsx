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

type ResizeDirection = "se" | "sw" | "ne" | "nw";

interface ImageComponentProps {
  src: string;
  altText: string;
  width: number | "inherit";
  height: number | "inherit";
  nodeKey: NodeKey;
}

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

  const style: React.CSSProperties = {};
  if (typeof imgSize.width === "number") style.width = `${imgSize.width}px`;
  if (typeof imgSize.height === "number") style.height = `${imgSize.height}px`;

  return (
    <span className={`relative inline-block ${isSelected ? "ring-2 ring-blue-500" : ""}`}>
      <img
        ref={imgRef}
        src={src}
        alt={altText}
        style={style}
        className="max-w-full rounded"
        draggable={false}
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
    </span>
  );
}
