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

export type SerializedYouTubeNode = Spread<
  { videoID: string },
  SerializedLexicalNode
>;

export class YouTubeNode extends DecoratorNode<ReactNode> {
  __videoID: string;

  static getType(): string {
    return "youtube";
  }

  static clone(node: YouTubeNode): YouTubeNode {
    return new YouTubeNode(node.__videoID, node.__key);
  }

  constructor(videoID: string, key?: NodeKey) {
    super(key);
    this.__videoID = videoID;
  }

  static importJSON(json: SerializedYouTubeNode): YouTubeNode {
    return $createYouTubeNode(json.videoID);
  }

  exportJSON(): SerializedYouTubeNode {
    return {
      type: "youtube",
      version: 1,
      videoID: this.__videoID,
    };
  }

  exportDOM(): DOMExportOutput {
    const div = document.createElement("div");
    div.style.aspectRatio = "16/9";
    const iframe = document.createElement("iframe");
    iframe.setAttribute("src", `https://www.youtube-nocookie.com/embed/${this.__videoID}`);
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("allowfullscreen", "true");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    div.appendChild(iframe);
    return { element: div };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement("div");
    div.className = "my-2";
    return div;
  }

  updateDOM(): false {
    return false;
  }

  getVideoID(): string {
    return this.__videoID;
  }

  decorate(): ReactNode {
    return (
      <div className="relative my-2 aspect-video w-full max-w-[560px] overflow-hidden rounded-lg">
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${this.__videoID}`}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="YouTube video"
        />
      </div>
    );
  }
}

export function $createYouTubeNode(videoID: string): YouTubeNode {
  return $applyNodeReplacement(new YouTubeNode(videoID));
}

export function $isYouTubeNode(node: LexicalNode | null | undefined): node is YouTubeNode {
  return node instanceof YouTubeNode;
}
