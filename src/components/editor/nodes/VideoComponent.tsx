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
import { useCallback, useEffect, useRef } from "react";
import { $isVideoNode } from "./VideoNode";

interface VideoComponentProps {
  src: string;
  fileName: string;
  mimeType: string;
  nodeKey: NodeKey;
}

export default function VideoComponent({
  src,
  fileName,
  nodeKey,
}: VideoComponentProps) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey);
  const videoRef = useRef<HTMLVideoElement>(null);

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
  }, [clearSelection, editor, isSelected, nodeKey, onDelete, setSelected]);

  return (
    <div
      className={`my-2 max-w-[560px] ${isSelected ? "rounded-lg ring-2 ring-blue-500" : ""}`}
    >
      <video
        ref={videoRef}
        src={src}
        controls
        className="w-full rounded-lg"
        preload="metadata"
      >
        Your browser does not support video playback.
      </video>
      <p className="mt-1 truncate text-xs text-zinc-500">{fileName}</p>
    </div>
  );
}
