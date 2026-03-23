"use client";

import type { ReactNode } from "react";
import Link from "next/link";
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

export type SerializedHashtagNode = Spread<
  { tagName: string },
  SerializedLexicalNode
>;

export class HashtagNode extends DecoratorNode<ReactNode> {
  __tagName: string;

  static getType(): string {
    return "hashtag";
  }

  static clone(node: HashtagNode): HashtagNode {
    return new HashtagNode(node.__tagName, node.__key);
  }

  constructor(tagName: string, key?: NodeKey) {
    super(key);
    this.__tagName = tagName;
  }

  static importJSON(json: SerializedHashtagNode): HashtagNode {
    return $createHashtagNode(json.tagName);
  }

  exportJSON(): SerializedHashtagNode {
    return {
      type: "hashtag",
      version: 1,
      tagName: this.__tagName,
    };
  }

  exportDOM(): DOMExportOutput {
    const span = document.createElement("span");
    span.textContent = `#${this.__tagName}`;
    span.setAttribute("data-hashtag-name", this.__tagName);
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
      <Link
        href={`/tag/${this.__tagName}`}
        className="inline font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        #{this.__tagName}
      </Link>
    );
  }
}

export function $createHashtagNode(tagName: string): HashtagNode {
  return $applyNodeReplacement(new HashtagNode(tagName));
}

export function $isHashtagNode(
  node: LexicalNode | null | undefined
): node is HashtagNode {
  return node instanceof HashtagNode;
}
