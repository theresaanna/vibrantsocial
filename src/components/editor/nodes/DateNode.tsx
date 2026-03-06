"use client";

import type { ReactNode } from "react";
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

export type SerializedDateNode = Spread<
  { date: string },
  SerializedLexicalNode
>;

export class DateNode extends DecoratorNode<ReactNode> {
  __date: string;

  static getType(): string {
    return "date";
  }

  static clone(node: DateNode): DateNode {
    return new DateNode(node.__date, node.__key);
  }

  constructor(date: string, key?: NodeKey) {
    super(key);
    this.__date = date;
  }

  static importJSON(json: SerializedDateNode): DateNode {
    return $createDateNode(json.date);
  }

  exportJSON(): SerializedDateNode {
    return {
      type: "date",
      version: 1,
      date: this.__date,
    };
  }

  exportDOM(): DOMExportOutput {
    const span = document.createElement("span");
    span.textContent = this.__date;
    return { element: span };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    return span;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): boolean {
    return true;
  }

  decorate(): ReactNode {
    return (
      <span className="inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        {this.__date}
      </span>
    );
  }
}

export function $createDateNode(date?: string): DateNode {
  const formatted = date ?? new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return $applyNodeReplacement(new DateNode(formatted));
}

export function $isDateNode(node: LexicalNode | null | undefined): node is DateNode {
  return node instanceof DateNode;
}
