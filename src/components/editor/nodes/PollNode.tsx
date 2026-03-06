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
import { useState, type ReactNode } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey } from "lexical";

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export type SerializedPollNode = Spread<
  { question: string; options: PollOption[] },
  SerializedLexicalNode
>;

function PollComponent({
  question,
  options: initialOptions,
  nodeKey,
}: {
  question: string;
  options: PollOption[];
  nodeKey: NodeKey;
}) {
  const [editor] = useLexicalComposerContext();
  const [options, setOptions] = useState(initialOptions);
  const [votedId, setVotedId] = useState<string | null>(null);

  const totalVotes = options.reduce((sum, o) => sum + o.votes, 0);

  function handleVote(optionId: string) {
    if (votedId) return;
    setVotedId(optionId);
    const updated = options.map((o) =>
      o.id === optionId ? { ...o, votes: o.votes + 1 } : o
    );
    setOptions(updated);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isPollNode(node)) {
        node.setOptions(updated);
      }
    });
  }

  return (
    <div className="my-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <p className="mb-3 font-medium text-zinc-900 dark:text-zinc-100">{question}</p>
      <div className="space-y-2">
        {options.map((option) => {
          const pct = totalVotes > 0 ? Math.round((option.votes / (totalVotes + (votedId ? 0 : 1))) * 100) : 0;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleVote(option.id)}
              disabled={!!votedId}
              className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                votedId
                  ? "cursor-default border-zinc-200 dark:border-zinc-700"
                  : "border-zinc-300 hover:border-blue-400 hover:bg-blue-50 dark:border-zinc-600 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
              }`}
            >
              {votedId && (
                <div
                  className={`absolute inset-y-0 left-0 ${
                    votedId === option.id ? "bg-blue-100 dark:bg-blue-900/30" : "bg-zinc-100 dark:bg-zinc-800"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              )}
              <span className="relative flex justify-between">
                <span>{option.text}</span>
                {votedId && <span className="text-zinc-500">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      {votedId && (
        <p className="mt-2 text-xs text-zinc-500">
          {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

export class PollNode extends DecoratorNode<ReactNode> {
  __question: string;
  __options: PollOption[];

  static getType(): string {
    return "poll";
  }

  static clone(node: PollNode): PollNode {
    return new PollNode(node.__question, [...node.__options], node.__key);
  }

  constructor(question: string, options: PollOption[], key?: NodeKey) {
    super(key);
    this.__question = question;
    this.__options = options;
  }

  static importJSON(json: SerializedPollNode): PollNode {
    return $createPollNode(json.question, json.options);
  }

  exportJSON(): SerializedPollNode {
    return {
      type: "poll",
      version: 1,
      question: this.__question,
      options: this.__options,
    };
  }

  exportDOM(): DOMExportOutput {
    const div = document.createElement("div");
    div.textContent = `Poll: ${this.__question}`;
    return { element: div };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    return document.createElement("div");
  }

  updateDOM(): false {
    return false;
  }

  setOptions(options: PollOption[]): void {
    const writable = this.getWritable();
    writable.__options = options;
  }

  decorate(): ReactNode {
    return (
      <PollComponent
        question={this.__question}
        options={this.__options}
        nodeKey={this.__key}
      />
    );
  }
}

export function $createPollNode(question: string, options: PollOption[]): PollNode {
  return $applyNodeReplacement(new PollNode(question, options));
}

export function $isPollNode(node: LexicalNode | null | undefined): node is PollNode {
  return node instanceof PollNode;
}
