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
import { $isVideoNode } from "./VideoNode";
import { VideoSidebar } from "./VideoSidebar";
import { ImageResizeModal } from "./ImageResizeModal";
import { useIsPostAuthor } from "../PostAuthorContext";

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

interface VideoComponentProps {
  src: string;
  fileName: string;
  mimeType: string;
  width: number | "inherit";
  height: number | "inherit";
  nodeKey: NodeKey;
}

export default function VideoComponent({
  src,
  fileName,
  width,
  height,
  nodeKey,
}: VideoComponentProps) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [videoSize, setVideoSize] = useState({ width, height });
  const isTouchDevice = useIsTouchDevice();
  const isDisplayMode = useIsPostAuthor();
  const isVideoEditable = editor.isEditable() && !isDisplayMode;

  const [showResizeModal, setShowResizeModal] = useState(false);

  const onDelete = useCallback(
    (event: KeyboardEvent) => {
      if (isSelected && $isNodeSelection($getSelection())) {
        event.preventDefault();
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isVideoNode(node)) node.remove();
        });
        return true;
      }
      return false;
    },
    [editor, isSelected, nodeKey]
  );

  useEffect(() => {
    if (isDisplayMode) return;
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          if (
            videoRef.current &&
            videoRef.current.contains(event.target as Node)
          ) {
            if (!event.shiftKey) clearSelection();
            setSelected(!isSelected);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        onDelete,
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        onDelete,
        COMMAND_PRIORITY_LOW
      )
    );
  }, [clearSelection, editor, isDisplayMode, isSelected, nodeKey, onDelete, setSelected]);

  const handleResizeStart = useCallback(
    (direction: ResizeDirection) => (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);

      const startX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const startWidth =
        typeof videoSize.width === "number" ? videoSize.width : videoRef.current?.videoWidth ?? 560;

      const xMultiplier = direction === "sw" || direction === "nw" ? -1 : 1;

      let latestWidth = startWidth;

      function onPointerMove(clientX: number) {
        latestWidth = Math.max(100, startWidth + xMultiplier * (clientX - startX));
        setVideoSize({ width: latestWidth, height: "inherit" });
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
          if ($isVideoNode(node)) {
            node.setWidthAndHeight(latestWidth, "inherit");
          }
        });
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", cleanup);
      document.addEventListener("touchmove", onTouchMove);
      document.addEventListener("touchend", cleanup);
    },
    [editor, videoSize.width, nodeKey]
  );

  const handleResizeApply = useCallback(
    (newWidth: number, newHeight: number) => {
      setVideoSize({ width: newWidth, height: newHeight });
      setShowResizeModal(false);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isVideoNode(node)) {
          node.setWidthAndHeight(newWidth, newHeight);
        }
      });
    },
    [editor, nodeKey]
  );

  const style: React.CSSProperties = {};
  if (typeof videoSize.width === "number") style.width = `${videoSize.width}px`;
  if (typeof videoSize.height === "number") style.height = `${videoSize.height}px`;

  const getRenderedDimensions = () => {
    const vid = videoRef.current;
    if (!vid) return { w: 560, h: 315, nw: 560, nh: 315 };
    return {
      w: typeof videoSize.width === "number" ? videoSize.width : vid.videoWidth || 560,
      h: typeof videoSize.height === "number" ? videoSize.height : vid.videoHeight || 315,
      nw: vid.videoWidth || 560,
      nh: vid.videoHeight || 315,
    };
  };

  const getEditorWidth = () => {
    const editorEl = editor.getRootElement();
    return editorEl?.clientWidth ?? 600;
  };

  return (
    <span className={`relative inline-block ${isSelected && isVideoEditable ? "ring-2 ring-blue-500" : ""}`}>
      <video
        ref={videoRef}
        src={src}
        controls
        style={style}
        className={`max-h-[50vh] max-w-full rounded-lg${isVideoEditable ? " cursor-grab active:cursor-grabbing" : ""}`}
        preload="metadata"
        draggable={isVideoEditable}
      >
        Your browser does not support video playback.
      </video>
      {isVideoEditable && (
        <p className="mt-1 truncate text-xs text-zinc-500">{fileName}</p>
      )}

      {isSelected && isVideoEditable && (
        <>
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

          <VideoSidebar
            isTouchDevice={isTouchDevice}
            onResizeClick={() => setShowResizeModal(true)}
          />
        </>
      )}

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
    </span>
  );
}
