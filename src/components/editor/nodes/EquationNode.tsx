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

const EquationComponent = lazy(() => import("./EquationComponent"));

export type SerializedEquationNode = Spread<
  { equation: string; inline: boolean },
  SerializedLexicalNode
>;

export class EquationNode extends DecoratorNode<ReactNode> {
  __equation: string;
  __inline: boolean;

  static getType(): string {
    return "equation";
  }

  static clone(node: EquationNode): EquationNode {
    return new EquationNode(node.__equation, node.__inline, node.__key);
  }

  constructor(equation: string, inline: boolean, key?: NodeKey) {
    super(key);
    this.__equation = equation;
    this.__inline = inline;
  }

  static importJSON(json: SerializedEquationNode): EquationNode {
    return $createEquationNode(json.equation, json.inline);
  }

  exportJSON(): SerializedEquationNode {
    return {
      type: "equation",
      version: 1,
      equation: this.__equation,
      inline: this.__inline,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement(this.__inline ? "span" : "div");
    element.textContent = this.__equation;
    return { element };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    return document.createElement(this.__inline ? "span" : "div");
  }

  updateDOM(): false {
    return false;
  }

  getEquation(): string {
    return this.__equation;
  }

  getInline(): boolean {
    return this.__inline;
  }

  setEquation(equation: string): void {
    const writable = this.getWritable();
    writable.__equation = equation;
  }

  decorate(): ReactNode {
    return (
      <Suspense fallback={<span>{this.__equation}</span>}>
        <EquationComponent
          equation={this.__equation}
          inline={this.__inline}
          nodeKey={this.__key}
        />
      </Suspense>
    );
  }
}

export function $createEquationNode(equation: string, inline: boolean): EquationNode {
  return $applyNodeReplacement(new EquationNode(equation, inline));
}

export function $isEquationNode(node: LexicalNode | null | undefined): node is EquationNode {
  return node instanceof EquationNode;
}
