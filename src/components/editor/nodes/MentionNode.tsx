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

export type SerializedMentionNode = Spread<
  { username: string; userId: string },
  SerializedLexicalNode
>;

export class MentionNode extends DecoratorNode<ReactNode> {
  __username: string;
  __userId: string;

  static getType(): string {
    return "mention";
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__username, node.__userId, node.__key);
  }

  constructor(username: string, userId: string, key?: NodeKey) {
    super(key);
    this.__username = username;
    this.__userId = userId;
  }

  static importJSON(json: SerializedMentionNode): MentionNode {
    return $createMentionNode(json.username, json.userId);
  }

  exportJSON(): SerializedMentionNode {
    return {
      type: "mention",
      version: 1,
      username: this.__username,
      userId: this.__userId,
    };
  }

  exportDOM(): DOMExportOutput {
    const span = document.createElement("span");
    span.textContent = `@${this.__username}`;
    span.setAttribute("data-mention-username", this.__username);
    span.setAttribute("data-mention-user-id", this.__userId);
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
        href={`/${this.__username}`}
        className="inline font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        @{this.__username}
      </Link>
    );
  }
}

export function $createMentionNode(
  username: string,
  userId: string
): MentionNode {
  return $applyNodeReplacement(new MentionNode(username, userId));
}

export function $isMentionNode(
  node: LexicalNode | null | undefined
): node is MentionNode {
  return node instanceof MentionNode;
}
