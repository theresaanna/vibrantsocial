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

const FileComponent = lazy(() => import("./FileComponent"));

export type SerializedFileNode = Spread<
  {
    src: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  },
  SerializedLexicalNode
>;

export class FileNode extends DecoratorNode<ReactNode> {
  __src: string;
  __fileName: string;
  __fileSize: number;
  __mimeType: string;

  static getType(): string {
    return "file";
  }

  static clone(node: FileNode): FileNode {
    return new FileNode(
      node.__src,
      node.__fileName,
      node.__fileSize,
      node.__mimeType,
      node.__key
    );
  }

  constructor(
    src: string,
    fileName: string,
    fileSize: number,
    mimeType: string,
    key?: NodeKey
  ) {
    super(key);
    this.__src = src;
    this.__fileName = fileName;
    this.__fileSize = fileSize;
    this.__mimeType = mimeType;
  }

  static importJSON(json: SerializedFileNode): FileNode {
    return $createFileNode({
      src: json.src,
      fileName: json.fileName,
      fileSize: json.fileSize,
      mimeType: json.mimeType,
    });
  }

  exportJSON(): SerializedFileNode {
    return {
      type: "file",
      version: 1,
      src: this.__src,
      fileName: this.__fileName,
      fileSize: this.__fileSize,
      mimeType: this.__mimeType,
    };
  }

  exportDOM(): DOMExportOutput {
    const a = document.createElement("a");
    a.setAttribute("href", this.__src);
    a.setAttribute("download", this.__fileName);
    a.textContent = this.__fileName;
    return { element: a };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement("div");
    const theme = config.theme;
    if (theme.file) {
      div.className = theme.file;
    }
    return div;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): ReactNode {
    return (
      <Suspense fallback={null}>
        <FileComponent
          src={this.__src}
          fileName={this.__fileName}
          fileSize={this.__fileSize}
          mimeType={this.__mimeType}
          nodeKey={this.__key}
        />
      </Suspense>
    );
  }
}

export function $createFileNode(payload: {
  src: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  key?: NodeKey;
}): FileNode {
  return $applyNodeReplacement(
    new FileNode(
      payload.src,
      payload.fileName,
      payload.fileSize,
      payload.mimeType,
      payload.key
    )
  );
}

export function $isFileNode(
  node: LexicalNode | null | undefined
): node is FileNode {
  return node instanceof FileNode;
}
