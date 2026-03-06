"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { $getNodeByKey, type NodeKey } from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import katex from "katex";
import { $isEquationNode } from "./EquationNode";

interface EquationComponentProps {
  equation: string;
  inline: boolean;
  nodeKey: NodeKey;
}

export default function EquationComponent({
  equation,
  inline,
  nodeKey,
}: EquationComponentProps) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected] = useLexicalNodeSelection(nodeKey);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(equation);
  const katexRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (katexRef.current && !isEditing) {
      try {
        katex.render(equation, katexRef.current, {
          displayMode: !inline,
          throwOnError: false,
          strict: false,
        });
      } catch {
        katexRef.current.textContent = equation;
      }
    }
  }, [equation, inline, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isEquationNode(node)) {
        node.setEquation(editValue);
      }
    });
    setIsEditing(false);
  }, [editor, editValue, nodeKey]);

  if (isEditing) {
    return (
      <span className={`inline-flex flex-col gap-1 ${inline ? "" : "my-2 w-full"}`}>
        <textarea
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSave();
            }
            if (e.key === "Escape") {
              setEditValue(equation);
              setIsEditing(false);
            }
          }}
          className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-800"
          rows={inline ? 1 : 3}
        />
        <span className="flex gap-1">
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-blue-500 px-2 py-0.5 text-xs text-white hover:bg-blue-600"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditValue(equation);
              setIsEditing(false);
            }}
            className="rounded bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-700"
          >
            Cancel
          </button>
        </span>
      </span>
    );
  }

  return (
    <span
      ref={katexRef}
      className={`cursor-pointer ${
        isSelected ? "ring-2 ring-blue-500 ring-offset-1" : ""
      } ${inline ? "inline" : "my-2 block text-center"}`}
      onClick={() => {
        setSelected(true);
      }}
      onDoubleClick={() => {
        if (editor.isEditable()) {
          setIsEditing(true);
          setEditValue(equation);
        }
      }}
      role="button"
      tabIndex={0}
    />
  );
}
