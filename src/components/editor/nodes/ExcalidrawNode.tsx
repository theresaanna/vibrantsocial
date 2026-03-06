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
import { Suspense, lazy, type ReactNode } from "react";

const ExcalidrawComponent = lazy(() => import("./ExcalidrawComponent"));

export type SerializedExcalidrawNode = Spread<
  { data: string },
  SerializedLexicalNode
>;

export class ExcalidrawNode extends DecoratorNode<ReactNode> {
  __data: string; // JSON-stringified Excalidraw scene

  static getType(): string {
    return "excalidraw";
  }

  static clone(node: ExcalidrawNode): ExcalidrawNode {
    return new ExcalidrawNode(node.__data, node.__key);
  }

  constructor(data: string = "{}", key?: NodeKey) {
    super(key);
    this.__data = data;
  }

  static importJSON(json: SerializedExcalidrawNode): ExcalidrawNode {
    return $createExcalidrawNode(json.data);
  }

  exportJSON(): SerializedExcalidrawNode {
    return {
      type: "excalidraw",
      version: 1,
      data: this.__data,
    };
  }

  exportDOM(): DOMExportOutput {
    const div = document.createElement("div");
    div.textContent = "[Excalidraw Drawing]";
    return { element: div };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    return document.createElement("div");
  }

  updateDOM(): false {
    return false;
  }

  getData(): string {
    return this.__data;
  }

  setData(data: string): void {
    const writable = this.getWritable();
    writable.__data = data;
  }

  decorate(): ReactNode {
    return (
      <Suspense
        fallback={
          <div className="my-2 flex h-48 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
            <span className="text-sm text-zinc-500">Loading drawing...</span>
          </div>
        }
      >
        <ExcalidrawComponent data={this.__data} nodeKey={this.__key} />
      </Suspense>
    );
  }
}

export function $createExcalidrawNode(data: string = "{}"): ExcalidrawNode {
  return $applyNodeReplacement(new ExcalidrawNode(data));
}

export function $isExcalidrawNode(
  node: LexicalNode | null | undefined
): node is ExcalidrawNode {
  return node instanceof ExcalidrawNode;
}
