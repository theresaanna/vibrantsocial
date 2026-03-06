"use client";

import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
} from "lexical";
import { useCallback, useEffect, type ReactNode } from "react";
import { mergeRegister } from "@lexical/utils";

function PageBreakComponent({ nodeKey }: { nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);

  const onDelete = useCallback(
    (event: KeyboardEvent) => {
      if (isSelected && $isNodeSelection($getSelection())) {
        event.preventDefault();
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (node) node.remove();
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
        (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (target.closest(`[data-page-break="${nodeKey}"]`)) {
            if (!e.shiftKey) clearSelection();
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

  return (
    <div
      data-page-break={nodeKey}
      className={`my-4 flex items-center gap-2 ${
        isSelected ? "ring-2 ring-blue-500 ring-offset-2" : ""
      }`}
    >
      <div className="h-px flex-1 border-t-2 border-dashed border-zinc-300 dark:border-zinc-600" />
      <span className="text-xs text-zinc-400 select-none">PAGE BREAK</span>
      <div className="h-px flex-1 border-t-2 border-dashed border-zinc-300 dark:border-zinc-600" />
    </div>
  );
}

export class PageBreakNode extends DecoratorNode<ReactNode> {
  static getType(): string {
    return "page-break";
  }

  static clone(node: PageBreakNode): PageBreakNode {
    return new PageBreakNode(node.__key);
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  static importJSON(): PageBreakNode {
    return $createPageBreakNode();
  }

  exportJSON(): SerializedLexicalNode {
    return { type: "page-break", version: 1 };
  }

  exportDOM(): DOMExportOutput {
    const hr = document.createElement("hr");
    hr.style.pageBreakAfter = "always";
    return { element: hr };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement("div");
    return div;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): ReactNode {
    return <PageBreakComponent nodeKey={this.__key} />;
  }
}

export function $createPageBreakNode(): PageBreakNode {
  return $applyNodeReplacement(new PageBreakNode());
}

export function $isPageBreakNode(node: LexicalNode | null | undefined): node is PageBreakNode {
  return node instanceof PageBreakNode;
}
