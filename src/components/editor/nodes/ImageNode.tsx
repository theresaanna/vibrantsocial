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

const ImageComponent = lazy(() => import("./ImageComponent"));

export type SerializedImageNode = Spread<
  {
    src: string;
    altText: string;
    width: number | "inherit";
    height: number | "inherit";
    caption?: string;
  },
  SerializedLexicalNode
>;

export class ImageNode extends DecoratorNode<ReactNode> {
  __src: string;
  __altText: string;
  __width: number | "inherit";
  __height: number | "inherit";
  __caption: string;

  static getType(): string {
    return "image";
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__altText,
      node.__width,
      node.__height,
      node.__caption,
      node.__key
    );
  }

  constructor(
    src: string,
    altText: string,
    width?: number | "inherit",
    height?: number | "inherit",
    caption?: string,
    key?: NodeKey
  ) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__width = width ?? "inherit";
    this.__height = height ?? "inherit";
    this.__caption = caption ?? "";
  }

  static importJSON(json: SerializedImageNode): ImageNode {
    return $createImageNode({
      src: json.src,
      altText: json.altText,
      width: json.width,
      height: json.height,
      caption: json.caption,
    });
  }

  exportJSON(): SerializedImageNode {
    return {
      type: "image",
      version: 1,
      src: this.__src,
      altText: this.__altText,
      width: this.__width,
      height: this.__height,
      caption: this.__caption,
    };
  }

  exportDOM(): DOMExportOutput {
    const img = document.createElement("img");
    img.setAttribute("src", this.__src);
    img.setAttribute("alt", this.__altText);
    if (typeof this.__width === "number") {
      img.style.width = `${this.__width}px`;
    }
    if (typeof this.__height === "number") {
      img.style.height = `${this.__height}px`;
    }
    return { element: img };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    const theme = config.theme;
    if (theme.image) {
      span.className = theme.image;
    }
    return span;
  }

  updateDOM(): false {
    return false;
  }

  setWidthAndHeight(width: number | "inherit", height: number | "inherit"): void {
    const writable = this.getWritable();
    writable.__width = width;
    writable.__height = height;
  }

  setAltText(altText: string): void {
    const writable = this.getWritable();
    writable.__altText = altText;
  }

  decorate(): ReactNode {
    return (
      <Suspense fallback={null}>
        <ImageComponent
          src={this.__src}
          altText={this.__altText}
          width={this.__width}
          height={this.__height}
          nodeKey={this.__key}
        />
      </Suspense>
    );
  }
}

export function $createImageNode({
  src,
  altText,
  width,
  height,
  caption,
  key,
}: {
  src: string;
  altText: string;
  width?: number | "inherit";
  height?: number | "inherit";
  caption?: string;
  key?: NodeKey;
}): ImageNode {
  return $applyNodeReplacement(new ImageNode(src, altText, width, height, caption, key));
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}
