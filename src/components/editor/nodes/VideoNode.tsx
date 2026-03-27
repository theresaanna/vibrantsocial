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

const VideoComponent = lazy(() => import("./VideoComponent"));

export type SerializedVideoNode = Spread<
  {
    src: string;
    fileName: string;
    mimeType: string;
    width: number | "inherit";
    height: number | "inherit";
  },
  SerializedLexicalNode
>;

export class VideoNode extends DecoratorNode<ReactNode> {
  __src: string;
  __fileName: string;
  __mimeType: string;
  __width: number | "inherit";
  __height: number | "inherit";

  static getType(): string {
    return "video";
  }

  static clone(node: VideoNode): VideoNode {
    return new VideoNode(
      node.__src,
      node.__fileName,
      node.__mimeType,
      node.__width,
      node.__height,
      node.__key
    );
  }

  constructor(
    src: string,
    fileName: string,
    mimeType: string,
    width?: number | "inherit",
    height?: number | "inherit",
    key?: NodeKey
  ) {
    super(key);
    this.__src = src;
    this.__fileName = fileName;
    this.__mimeType = mimeType;
    this.__width = width ?? "inherit";
    this.__height = height ?? "inherit";
  }

  static importJSON(json: SerializedVideoNode): VideoNode {
    return $createVideoNode({
      src: json.src,
      fileName: json.fileName,
      mimeType: json.mimeType,
      width: json.width,
      height: json.height,
    });
  }

  exportJSON(): SerializedVideoNode {
    return {
      type: "video",
      version: 1,
      src: this.__src,
      fileName: this.__fileName,
      mimeType: this.__mimeType,
      width: this.__width,
      height: this.__height,
    };
  }

  exportDOM(): DOMExportOutput {
    const video = document.createElement("video");
    video.setAttribute("src", this.__src);
    video.setAttribute("controls", "true");
    video.style.maxWidth = "100%";
    if (typeof this.__width === "number") {
      video.style.width = `${this.__width}px`;
    }
    if (typeof this.__height === "number") {
      video.style.height = `${this.__height}px`;
    }
    return { element: video };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement("div");
    const theme = config.theme;
    if (theme.video) {
      div.className = theme.video;
    }
    return div;
  }

  updateDOM(): false {
    return false;
  }

  setWidthAndHeight(width: number | "inherit", height: number | "inherit"): void {
    const writable = this.getWritable();
    writable.__width = width;
    writable.__height = height;
  }

  decorate(): ReactNode {
    return (
      <Suspense fallback={null}>
        <VideoComponent
          src={this.__src}
          fileName={this.__fileName}
          mimeType={this.__mimeType}
          width={this.__width}
          height={this.__height}
          nodeKey={this.__key}
        />
      </Suspense>
    );
  }
}

export function $createVideoNode(payload: {
  src: string;
  fileName: string;
  mimeType: string;
  width?: number | "inherit";
  height?: number | "inherit";
  key?: NodeKey;
}): VideoNode {
  return $applyNodeReplacement(
    new VideoNode(payload.src, payload.fileName, payload.mimeType, payload.width, payload.height, payload.key)
  );
}

export function $isVideoNode(
  node: LexicalNode | null | undefined
): node is VideoNode {
  return node instanceof VideoNode;
}
