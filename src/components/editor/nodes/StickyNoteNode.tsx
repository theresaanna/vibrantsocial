"use client";

import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import { useState, type ReactNode } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey } from "lexical";

type StickyColor = "yellow" | "pink" | "green";

const colorMap: Record<StickyColor, string> = {
  yellow: "bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700",
  pink: "bg-pink-100 dark:bg-pink-900/40 border-pink-300 dark:border-pink-700",
  green: "bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700",
};

export type SerializedStickyNoteNode = Spread<
  { text: string; color: StickyColor },
  SerializedLexicalNode
>;

function StickyNoteComponent({
  text,
  color,
  nodeKey,
}: {
  text: string;
  color: StickyColor;
  nodeKey: NodeKey;
}) {
  const [editor] = useLexicalComposerContext();
  const [value, setValue] = useState(text);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newText = e.target.value;
    setValue(newText);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isStickyNoteNode(node)) {
        node.setText(newText);
      }
    });
  }

  function handleDelete() {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node) node.remove();
    });
  }

  return (
    <div
      className={`my-2 inline-block w-64 rounded-lg border p-3 shadow-sm ${colorMap[color]}`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500 select-none">Sticky Note</span>
        {editor.isEditable() && (
          <button
            type="button"
            onClick={handleDelete}
            className="text-zinc-400 hover:text-red-500"
            aria-label="Delete sticky note"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {editor.isEditable() ? (
        <textarea
          value={value}
          onChange={handleChange}
          className="w-full resize-none bg-transparent text-sm outline-none"
          rows={4}
          placeholder="Write something..."
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm">{value}</p>
      )}
    </div>
  );
}

export class StickyNoteNode extends DecoratorNode<ReactNode> {
  __text: string;
  __color: StickyColor;

  static getType(): string {
    return "sticky-note";
  }

  static clone(node: StickyNoteNode): StickyNoteNode {
    return new StickyNoteNode(node.__text, node.__color, node.__key);
  }

  constructor(text: string = "", color: StickyColor = "yellow", key?: NodeKey) {
    super(key);
    this.__text = text;
    this.__color = color;
  }

  static importJSON(json: SerializedStickyNoteNode): StickyNoteNode {
    return $createStickyNoteNode(json.text, json.color);
  }

  exportJSON(): SerializedStickyNoteNode {
    return {
      type: "sticky-note",
      version: 1,
      text: this.__text,
      color: this.__color,
    };
  }

  exportDOM(): DOMExportOutput {
    const div = document.createElement("div");
    div.textContent = this.__text;
    div.style.backgroundColor = this.__color;
    div.style.padding = "8px";
    return { element: div };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    return document.createElement("div");
  }

  updateDOM(): false {
    return false;
  }

  setText(text: string): void {
    const writable = this.getWritable();
    writable.__text = text;
  }

  decorate(): ReactNode {
    return (
      <StickyNoteComponent
        text={this.__text}
        color={this.__color}
        nodeKey={this.__key}
      />
    );
  }
}

export function $createStickyNoteNode(
  text: string = "",
  color: StickyColor = "yellow"
): StickyNoteNode {
  return $applyNodeReplacement(new StickyNoteNode(text, color));
}

export function $isStickyNoteNode(node: LexicalNode | null | undefined): node is StickyNoteNode {
  return node instanceof StickyNoteNode;
}
