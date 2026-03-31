"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { FramedAvatar } from "@/components/framed-avatar";
import { timeAgo } from "@/lib/time";
import {
  askQuestion,
  answerQuestion,
  deleteQuestion,
  getQuestions,
  type MarketplaceQuestionData,
} from "@/app/marketplace/qa-actions";

interface MarketplaceQAProps {
  marketplacePostId: string;
  postAuthorId: string;
  currentUserId?: string;
}

export function MarketplaceQA({
  marketplacePostId,
  postAuthorId,
  currentUserId,
}: MarketplaceQAProps) {
  const [questions, setQuestions] = useState<MarketplaceQuestionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const isAuthor = currentUserId === postAuthorId;

  useEffect(() => {
    let cancelled = false;
    getQuestions(marketplacePostId).then((data) => {
      if (!cancelled) {
        setQuestions(data);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [marketplacePostId]);

  function handleAsk() {
    if (!newQuestion.trim()) return;
    setError("");

    startTransition(async () => {
      const result = await askQuestion(marketplacePostId, newQuestion);
      if (result.success) {
        setNewQuestion("");
        const updated = await getQuestions(marketplacePostId);
        setQuestions(updated);
      } else {
        setError(result.message);
      }
    });
  }

  function handleAnswer(questionId: string, answer: string) {
    startTransition(async () => {
      const result = await answerQuestion(questionId, answer);
      if (result.success) {
        const updated = await getQuestions(marketplacePostId);
        setQuestions(updated);
      }
    });
  }

  function handleDelete(questionId: string) {
    startTransition(async () => {
      const result = await deleteQuestion(questionId);
      if (result.success) {
        setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      }
    });
  }

  return (
    <div
      className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800"
      data-testid="marketplace-qa"
    >
      <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        <svg
          className="h-4 w-4 text-pink-500"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
          />
        </svg>
        Q&A
        {questions.length > 0 && (
          <span className="text-xs font-normal text-zinc-400">
            ({questions.length})
          </span>
        )}
      </h4>

      {/* Ask question form */}
      {currentUserId && !isAuthor && (
        <div className="mb-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Ask a question about this item..."
              className="flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-pink-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-pink-500"
              maxLength={1000}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
              data-testid="marketplace-qa-input"
            />
            <button
              type="button"
              onClick={handleAsk}
              disabled={isPending || !newQuestion.trim()}
              className="rounded-lg bg-pink-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-pink-400 disabled:opacity-50"
              data-testid="marketplace-qa-submit"
            >
              Ask
            </button>
          </div>
          {error && (
            <p className="mt-1 text-xs text-red-500">{error}</p>
          )}
        </div>
      )}

      {/* Questions list */}
      {isLoading ? (
        <div className="flex justify-center py-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
        </div>
      ) : questions.length === 0 ? (
        <p className="text-sm text-zinc-400">
          No questions yet. {!isAuthor && currentUserId ? "Be the first to ask!" : ""}
        </p>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <QuestionItem
              key={q.id}
              question={q}
              isAuthor={isAuthor}
              currentUserId={currentUserId}
              onAnswer={handleAnswer}
              onDelete={handleDelete}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionItem({
  question,
  isAuthor,
  currentUserId,
  onAnswer,
  onDelete,
  isPending,
}: {
  question: MarketplaceQuestionData;
  isAuthor: boolean;
  currentUserId?: string;
  onAnswer: (questionId: string, answer: string) => void;
  onDelete: (questionId: string) => void;
  isPending: boolean;
}) {
  const [answerText, setAnswerText] = useState("");
  const [showAnswerInput, setShowAnswerInput] = useState(false);

  const canDelete =
    currentUserId === question.asker.id || isAuthor;

  return (
    <div
      className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50"
      data-testid="marketplace-qa-item"
    >
      {/* Question */}
      <div className="flex items-start gap-2">
        <Link href={`/${question.asker.username}`} className="shrink-0">
          <FramedAvatar
            src={question.asker.avatar ?? question.asker.image}
            alt={question.asker.displayName ?? question.asker.username ?? ""}
            size={24}
            frameId={question.asker.profileFrameId}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/${question.asker.username}`}
              className="text-xs font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
            >
              {question.asker.displayName ?? question.asker.username}
            </Link>
            <span className="text-xs text-zinc-400">
              {timeAgo(question.createdAt)}
            </span>
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(question.id)}
                disabled={isPending}
                className="ml-auto text-xs text-zinc-400 hover:text-red-500 disabled:opacity-50"
                title="Delete question"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
          <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">
            {question.question}
          </p>
        </div>
      </div>

      {/* Answer */}
      {question.answer ? (
        <div className="ml-8 mt-2 rounded-md border-l-2 border-pink-300 bg-pink-50/50 py-1.5 pl-3 pr-2 dark:border-pink-700 dark:bg-pink-950/20">
          <p className="text-xs font-semibold text-pink-700 dark:text-pink-400">
            Seller
          </p>
          <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">
            {question.answer}
          </p>
          {question.answeredAt && (
            <span className="mt-1 block text-xs text-zinc-400">
              {timeAgo(question.answeredAt)}
            </span>
          )}
        </div>
      ) : isAuthor ? (
        <div className="ml-8 mt-2">
          {showAnswerInput ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Write your answer..."
                className="flex-1 rounded-md border border-zinc-200 px-2.5 py-1 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-pink-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-pink-500"
                maxLength={2000}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (answerText.trim()) {
                      onAnswer(question.id, answerText);
                      setShowAnswerInput(false);
                      setAnswerText("");
                    }
                  }
                }}
                data-testid="marketplace-qa-answer-input"
              />
              <button
                type="button"
                onClick={() => {
                  if (answerText.trim()) {
                    onAnswer(question.id, answerText);
                    setShowAnswerInput(false);
                    setAnswerText("");
                  }
                }}
                disabled={isPending || !answerText.trim()}
                className="rounded-md bg-pink-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-pink-400 disabled:opacity-50"
                data-testid="marketplace-qa-answer-submit"
              >
                Answer
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAnswerInput(false);
                  setAnswerText("");
                }}
                className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAnswerInput(true)}
              className="text-xs font-medium text-pink-600 hover:text-pink-500 dark:text-pink-400"
              data-testid="marketplace-qa-reply-button"
            >
              Answer this question
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
