"use client";

import {
  $applyNodeReplacement,
  $createParagraphNode,
  $createTextNode,
  ElementNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type RangeSelection,
} from "lexical";

/* ── Container ─────────────────────────────────────────── */
export type SerializedCollapsibleContainerNode = SerializedElementNode & { open: boolean };

export class CollapsibleContainerNode extends ElementNode {
  __open: boolean;

  static getType(): string {
    return "collapsible-container";
  }

  static clone(node: CollapsibleContainerNode): CollapsibleContainerNode {
    return new CollapsibleContainerNode(node.__open, node.__key);
  }

  constructor(open: boolean = true, key?: NodeKey) {
    super(key);
    this.__open = open;
  }

  static importJSON(json: SerializedCollapsibleContainerNode): CollapsibleContainerNode {
    const node = $createCollapsibleContainerNode(json.open);
    return node;
  }

  exportJSON(): SerializedCollapsibleContainerNode {
    return { ...super.exportJSON(), type: "collapsible-container", open: this.__open, version: 1 };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const el = document.createElement("details");
    el.open = this.__open;
    el.className =
      "my-2 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden";
    return el;
  }

  updateDOM(prevNode: CollapsibleContainerNode, dom: HTMLDetailsElement): boolean {
    if (prevNode.__open !== this.__open) {
      dom.open = this.__open;
    }
    return false;
  }

  setOpen(open: boolean): void {
    const writable = this.getWritable();
    writable.__open = open;
  }

  getOpen(): boolean {
    return this.__open;
  }

  isShadowRoot(): boolean {
    return true;
  }
}

/* ── Title ─────────────────────────────────────────────── */
export class CollapsibleTitleNode extends ElementNode {
  static getType(): string {
    return "collapsible-title";
  }

  static clone(node: CollapsibleTitleNode): CollapsibleTitleNode {
    return new CollapsibleTitleNode(node.__key);
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  static importJSON(_json: SerializedElementNode): CollapsibleTitleNode {
    return $createCollapsibleTitleNode();
  }

  exportJSON(): SerializedElementNode {
    return { ...super.exportJSON(), type: "collapsible-title", version: 1 };
  }

  createDOM(): HTMLElement {
    const el = document.createElement("summary");
    el.className =
      "cursor-pointer px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/50";
    return el;
  }

  updateDOM(): boolean {
    return false;
  }

  insertNewAfter(_selection: RangeSelection): null {
    return null;
  }

  collapseAtStart(): true {
    return true;
  }
}

/* ── Content ───────────────────────────────────────────── */
export class CollapsibleContentNode extends ElementNode {
  static getType(): string {
    return "collapsible-content";
  }

  static clone(node: CollapsibleContentNode): CollapsibleContentNode {
    return new CollapsibleContentNode(node.__key);
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  static importJSON(_json: SerializedElementNode): CollapsibleContentNode {
    return $createCollapsibleContentNode();
  }

  exportJSON(): SerializedElementNode {
    return { ...super.exportJSON(), type: "collapsible-content", version: 1 };
  }

  createDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "border-t border-zinc-200 dark:border-zinc-700 px-3 py-2";
    return div;
  }

  updateDOM(): boolean {
    return false;
  }

  isShadowRoot(): boolean {
    return true;
  }
}

/* ── Helpers ───────────────────────────────────────────── */
export function $createCollapsibleContainerNode(open = true): CollapsibleContainerNode {
  return $applyNodeReplacement(new CollapsibleContainerNode(open));
}

export function $createCollapsibleTitleNode(): CollapsibleTitleNode {
  return $applyNodeReplacement(new CollapsibleTitleNode());
}

export function $createCollapsibleContentNode(): CollapsibleContentNode {
  return $applyNodeReplacement(new CollapsibleContentNode());
}

export function $createCollapsibleWithDefaults(): CollapsibleContainerNode {
  const container = $createCollapsibleContainerNode(true);
  const title = $createCollapsibleTitleNode();
  title.append($createTextNode("Click to expand"));
  const content = $createCollapsibleContentNode();
  content.append($createParagraphNode());
  container.append(title, content);
  return container;
}
