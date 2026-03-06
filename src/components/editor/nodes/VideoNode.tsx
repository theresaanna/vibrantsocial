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
  },
  SerializedLexicalNode
>;

export class VideoNode extends DecoratorNode<ReactNode> {
  __src: string;
  __fileName: string;
  __mimeType: string;

  static getType(): string {
    return "video";
  }

  static clone(node: VideoNode): VideoNode {
    return new VideoNode(
      node.__src,
      node.__fileName,
      node.__mimeType,
      node.__key
    );
  }

  constructor(src: string, fileName: string, mimeType: string, key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__fileName = fileName;
    this.__mimeType = mimeType;
  }

  static importJSON(json: SerializedVideoNode): VideoNode {
    return $createVideoNode({
      src: json.src,
      fileName: json.fileName,
      mimeType: json.mimeType,
    });
  }

  exportJSON(): SerializedVideoNode {
    return {
      type: "video",
      version: 1,
      src: this.__src,
      fileName: this.__fileName,
      mimeType: this.__mimeType,
    };
  }

  exportDOM(): DOMExportOutput {
    const video = document.createElement("video");
    video.setAttribute("src", this.__src);
    video.setAttribute("controls", "true");
    video.style.maxWidth = "100%";
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

  decorate(): ReactNode {
    return (
      <Suspense fallback={null}>
        <VideoComponent
          src={this.__src}
          fileName={this.__fileName}
          mimeType={this.__mimeType}
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
  key?: NodeKey;
}): VideoNode {
  return $applyNodeReplacement(
    new VideoNode(payload.src, payload.fileName, payload.mimeType, payload.key)
  );
}

export function $isVideoNode(
  node: LexicalNode | null | undefined
): node is VideoNode {
  return node instanceof VideoNode;
}
