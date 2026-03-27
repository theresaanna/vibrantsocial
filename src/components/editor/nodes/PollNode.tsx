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
import { useState, useEffect, type ReactNode } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey } from "lexical";
import { useIsPostAuthor } from "../PostAuthorContext";

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export type SerializedPollNode = Spread<
  { question: string; options: PollOption[]; expiresAt: string | null },
  SerializedLexicalNode
>;

function PollComponent({
  question,
  options: initialOptions,
  expiresAt,
  nodeKey,
}: {
  question: string;
  options: PollOption[];
  expiresAt: string | null;
  nodeKey: NodeKey;
}) {
  const [editor] = useLexicalComposerContext();
  const isPostAuthor = useIsPostAuthor();
  const [options, setOptions] = useState(initialOptions);
  const [votedId, setVotedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const totalVotes = options.reduce((sum, o) => sum + o.votes, 0);
  const isExpired = expiresAt ? new Date(expiresAt).getTime() <= now : false;

  useEffect(() => {
    if (!expiresAt || isExpired) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt, isExpired]);

  function getTimeRemaining(): string {
    if (!expiresAt) return "";
    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) return "Poll ended";
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h remaining`;
    if (hours > 0) return `${hours}h ${minutes % 60}m remaining`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s remaining`;
    return `${seconds}s remaining`;
  }

  function handleVote(optionId: string) {
    if (votedId || isExpired) return;
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

  const showResults = !!votedId || isExpired || isPostAuthor;

  return (
    <div className="poll-border my-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <p className="poll-question mb-3 font-medium text-zinc-900 dark:text-zinc-100">{question}</p>
      <div className="space-y-2">
        {options.map((option) => {
          const pct = totalVotes > 0 ? Math.round((option.votes / (totalVotes + (showResults ? 0 : 1))) * 100) : 0;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleVote(option.id)}
              disabled={showResults}
              className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                showResults
                  ? `poll-option-result cursor-default border-zinc-200 dark:border-zinc-700`
                  : `poll-option border-zinc-300 hover:border-blue-400 hover:bg-blue-50 dark:border-zinc-600 dark:hover:border-blue-500 dark:hover:bg-blue-900/20`
              }`}
            >
              {showResults && (
                <div
                  className={`absolute inset-y-0 left-0 ${
                    votedId === option.id
                      ? "poll-bar-voted bg-blue-100 dark:bg-blue-900/30"
                      : "poll-bar-default bg-zinc-100 dark:bg-zinc-800"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              )}
              <span className="relative flex justify-between">
                <span className="poll-option-text">{option.text}</span>
                {showResults && <span className="poll-pct text-zinc-500">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      {showResults && (
        <p className="poll-meta mt-2 text-xs text-zinc-500">
          {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
        </p>
      )}
      {expiresAt && (
        <p className={`poll-meta mt-1 text-xs ${isExpired ? "text-red-500" : "text-zinc-500"}`}>
          {getTimeRemaining()}
        </p>
      )}
    </div>
  );
}

export class PollNode extends DecoratorNode<ReactNode> {
  __question: string;
  __options: PollOption[];
  __expiresAt: string | null;

  static getType(): string {
    return "poll";
  }

  static clone(node: PollNode): PollNode {
    return new PollNode(node.__question, [...node.__options], node.__expiresAt, node.__key);
  }

  constructor(question: string, options: PollOption[], expiresAt: string | null = null, key?: NodeKey) {
    super(key);
    this.__question = question;
    this.__options = options;
    this.__expiresAt = expiresAt;
  }

  static importJSON(json: SerializedPollNode): PollNode {
    return $createPollNode(json.question, json.options, (json as Record<string, unknown>).expiresAt as string | null ?? null);
  }

  exportJSON(): SerializedPollNode {
    return {
      type: "poll",
      version: 2,
      question: this.__question,
      options: this.__options,
      expiresAt: this.__expiresAt,
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

  getExpiresAt(): string | null {
    return this.__expiresAt;
  }

  decorate(): ReactNode {
    return (
      <PollComponent
        question={this.__question}
        options={this.__options}
        expiresAt={this.__expiresAt}
        nodeKey={this.__key}
      />
    );
  }
}

export function $createPollNode(
  question: string,
  options: PollOption[],
  expiresAt: string | null = null,
): PollNode {
  return $applyNodeReplacement(new PollNode(question, options, expiresAt));
}

export function $isPollNode(node: LexicalNode | null | undefined): node is PollNode {
  return node instanceof PollNode;
}
