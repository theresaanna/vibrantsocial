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
import { $isFileNode } from "./FileNode";

interface FileComponentProps {
  src: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  nodeKey: NodeKey;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileComponent({
  src,
  fileName,
  fileSize,
  nodeKey,
}: FileComponentProps) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey);
  const cardRef = useRef<HTMLDivElement>(null);

  const onDelete = useCallback(
    (event: KeyboardEvent) => {
      if (isSelected && $isNodeSelection($getSelection())) {
        event.preventDefault();
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isFileNode(node)) node.remove();
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
            cardRef.current &&
            cardRef.current.contains(event.target as Node)
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
      ref={cardRef}
      className={`my-2 inline-flex max-w-sm items-center gap-3 rounded-lg border px-4 py-3
        border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800
        ${isSelected ? "ring-2 ring-blue-500" : ""}
      `}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {fileName}
        </a>
        <p className="text-xs text-zinc-500">{formatFileSize(fileSize)}</p>
      </div>
    </div>
  );
}
