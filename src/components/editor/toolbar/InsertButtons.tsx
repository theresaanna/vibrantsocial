"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $insertNodes, $createParagraphNode } from "lexical";
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode";
import {
  INSERT_TABLE_COMMAND,
  type InsertTableCommandPayload,
} from "@lexical/table";
import { useState, useRef, type ChangeEvent } from "react";
import { Modal } from "../ui/Modal";
import { $createImageNode } from "../nodes/ImageNode";
import { $createVideoNode } from "../nodes/VideoNode";
import { $createFileNode } from "../nodes/FileNode";
import { $createYouTubeNode } from "../nodes/YouTubeNode";
import { $createEquationNode } from "../nodes/EquationNode";
import { $createCollapsibleWithDefaults } from "../nodes/CollapsibleNodes";
import { $createStickyNoteNode } from "../nodes/StickyNoteNode";
import { $createPollNode, type PollOption } from "../nodes/PollNode";
import { extractYouTubeVideoID } from "../utils/url";
import { upload } from "@vercel/blob/client";

const btnClass =
  "rounded p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700";

/* ── Toolbar icon button wrapper ─────────────────── */
function ToolbarButton({
  onClick,
  label,
  title,
  children,
}: {
  onClick: () => void;
  label: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={btnClass}
      aria-label={label}
      title={title ?? label}
    >
      {children}
    </button>
  );
}

/* ── File Upload (images, videos, PDFs) ──────────── */
export function FileUploadButton() {
  const [editor] = useLexicalComposerContext();
  const [modal, setModal] = useState(false);

  return (
    <>
      <ToolbarButton onClick={() => setModal(true)} label="Upload file">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      </ToolbarButton>
      {modal && (
        <UnifiedUploadModal
          editor={editor}
          onClose={() => setModal(false)}
        />
      )}
    </>
  );
}

/* ── Horizontal Rule ─────────────────────────────── */
export function HorizontalRuleButton() {
  const [editor] = useLexicalComposerContext();
  return (
    <ToolbarButton
      onClick={() => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)}
      label="Horizontal rule"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16" />
      </svg>
    </ToolbarButton>
  );
}

/* ── YouTube ─────────────────────────────────────── */
export function YouTubeButton() {
  const [editor] = useLexicalComposerContext();
  const [modal, setModal] = useState(false);
  return (
    <>
      <ToolbarButton onClick={() => setModal(true)} label="YouTube video">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      </ToolbarButton>
      {modal && (
        <YouTubeInsertModal
          onClose={() => setModal(false)}
          onInsert={(videoID) => {
            editor.update(() => {
              const node = $createYouTubeNode(videoID);
              $insertNodes([node, $createParagraphNode()]);
            });
            setModal(false);
          }}
        />
      )}
    </>
  );
}

/* ── Table ───────────────────────────────────────── */
export function TableButton() {
  const [editor] = useLexicalComposerContext();
  const [modal, setModal] = useState(false);
  return (
    <>
      <ToolbarButton onClick={() => setModal(true)} label="Table">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 3v18M14 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" />
        </svg>
      </ToolbarButton>
      {modal && (
        <TableInsertModal
          onClose={() => setModal(false)}
          onInsert={(rows, cols) => {
            editor.dispatchCommand(INSERT_TABLE_COMMAND, {
              rows: String(rows),
              columns: String(cols),
              includeHeaders: true,
            } as InsertTableCommandPayload);
            setModal(false);
          }}
        />
      )}
    </>
  );
}

/* ── Poll ────────────────────────────────────────── */
export function PollButton() {
  const [editor] = useLexicalComposerContext();
  const [modal, setModal] = useState(false);
  return (
    <>
      <ToolbarButton onClick={() => setModal(true)} label="Poll">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </ToolbarButton>
      {modal && (
        <PollInsertModal
          onClose={() => setModal(false)}
          onInsert={(question, options) => {
            editor.update(() => {
              const node = $createPollNode(question, options);
              $insertNodes([node, $createParagraphNode()]);
            });
            setModal(false);
          }}
        />
      )}
    </>
  );
}

/* ── Equation ────────────────────────────────────── */
export function EquationButton() {
  const [editor] = useLexicalComposerContext();
  const [modal, setModal] = useState(false);
  return (
    <>
      <ToolbarButton onClick={() => setModal(true)} label="Equation">
        <span className="text-sm font-serif italic leading-none">fx</span>
      </ToolbarButton>
      {modal && (
        <EquationInsertModal
          onClose={() => setModal(false)}
          onInsert={(equation, inline) => {
            editor.update(() => {
              const node = $createEquationNode(equation, inline);
              $insertNodes([node]);
            });
            setModal(false);
          }}
        />
      )}
    </>
  );
}

/* ── Collapsible ─────────────────────────────────── */
export function CollapsibleButton() {
  const [editor] = useLexicalComposerContext();
  return (
    <ToolbarButton
      onClick={() => {
        editor.update(() => {
          const container = $createCollapsibleWithDefaults();
          $insertNodes([container, $createParagraphNode()]);
        });
      }}
      label="Collapsible"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </ToolbarButton>
  );
}

/* ── Sticky Note ─────────────────────────────────── */
export function StickyNoteButton() {
  const [editor] = useLexicalComposerContext();
  return (
    <ToolbarButton
      onClick={() => {
        editor.update(() => {
          const node = $createStickyNoteNode();
          $insertNodes([node, $createParagraphNode()]);
        });
      }}
      label="Sticky note"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </ToolbarButton>
  );
}

/* ══════════════════════════════════════════════════ */
/* ── Modals (kept from original InsertDropdown) ─── */
/* ══════════════════════════════════════════════════ */

/* ── Unified Upload Modal ────────────────────────── */
function UnifiedUploadModal({
  editor,
  onClose,
}: {
  editor: ReturnType<typeof useLexicalComposerContext>[0];
  onClose: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptTypes = [
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/heic", "image/heif",
    ".heic", ".heif",
    "video/mp4", "video/webm", "video/quicktime", "video/ogg",
    ".mp4", ".webm", ".mov", ".ogv",
    "application/pdf", ".pdf",
  ].join(",");

  async function handleFile(file: File) {
    setError("");
    setUploading(true);

    try {
      if (file.type.startsWith("image/") || file.name.match(/\.(heic|heif)$/i)) {
        if (file.size > 5 * 1024 * 1024) {
          setError("Image must be under 5MB");
          setUploading(false);
          return;
        }
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Upload failed");
        }
        const { url } = await res.json();
        editor.update(() => {
          $insertNodes([$createImageNode({ src: url, altText: file.name }), $createParagraphNode()]);
        });
      } else if (file.type.startsWith("video/")) {
        if (file.size > 50 * 1024 * 1024) {
          setError("Video must be under 50MB");
          setUploading(false);
          return;
        }
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/upload/client",
          clientPayload: "video",
        });
        editor.update(() => {
          $insertNodes([$createVideoNode({ src: blob.url, fileName: file.name, mimeType: file.type }), $createParagraphNode()]);
        });
      } else if (file.type === "application/pdf") {
        if (file.size > 10 * 1024 * 1024) {
          setError("File must be under 10MB");
          setUploading(false);
          return;
        }
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/upload/client",
          clientPayload: "document",
        });
        editor.update(() => {
          $insertNodes([$createFileNode({ src: blob.url, fileName: file.name, fileSize: file.size, mimeType: file.type }), $createParagraphNode()]);
        });
      } else {
        setError("Unsupported file type");
        setUploading(false);
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <Modal title="Upload File" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={acceptTypes}
            onChange={handleChange}
            className="hidden"
            disabled={uploading}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 px-4 py-6 text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-300"
          >
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span className="text-sm font-medium">
              {uploading ? "Uploading..." : "Choose a file"}
            </span>
          </button>
          <p className="mt-2 text-center text-xs text-zinc-400">
            Images (5MB), Videos (50MB), PDF (10MB)
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}

/* ── YouTube Insert Modal ─────────────────────────── */
function YouTubeInsertModal({
  onClose,
  onInsert,
}: {
  onClose: () => void;
  onInsert: (videoID: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  function handleInsert() {
    const videoID = extractYouTubeVideoID(url);
    if (!videoID) {
      setError("Please enter a valid YouTube URL");
      return;
    }
    onInsert(videoID);
  }

  return (
    <Modal title="Insert YouTube Video" onClose={onClose}>
      <div className="space-y-3">
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError("");
          }}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          autoFocus
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={handleInsert}
          disabled={!url}
          className="rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
        >
          Insert
        </button>
      </div>
    </Modal>
  );
}

/* ── Equation Insert Modal ────────────────────────── */
function EquationInsertModal({
  onClose,
  onInsert,
}: {
  onClose: () => void;
  onInsert: (equation: string, inline: boolean) => void;
}) {
  const [equation, setEquation] = useState("");
  const [inline, setInline] = useState(true);

  return (
    <Modal title="Insert Equation" onClose={onClose}>
      <div className="space-y-3">
        <textarea
          value={equation}
          onChange={(e) => setEquation(e.target.value)}
          placeholder="e.g. E = mc^2"
          className="w-full rounded border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-800"
          rows={3}
          autoFocus
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={inline}
            onChange={(e) => setInline(e.target.checked)}
          />
          Inline equation
        </label>
        <button
          type="button"
          onClick={() => {
            if (equation.trim()) onInsert(equation.trim(), inline);
          }}
          disabled={!equation.trim()}
          className="rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
        >
          Insert
        </button>
      </div>
    </Modal>
  );
}

/* ── Table Insert Modal ───────────────────────────── */
function TableInsertModal({
  onClose,
  onInsert,
}: {
  onClose: () => void;
  onInsert: (rows: number, cols: number) => void;
}) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);

  return (
    <Modal title="Insert Table" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            Rows:
            <input
              type="number"
              value={rows}
              onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={20}
              className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            Columns:
            <input
              type="number"
              value={cols}
              onChange={(e) => setCols(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={10}
              className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => onInsert(rows, cols)}
          className="rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
        >
          Insert Table
        </button>
      </div>
    </Modal>
  );
}

/* ── Poll Insert Modal ────────────────────────────── */
function PollInsertModal({
  onClose,
  onInsert,
}: {
  onClose: () => void;
  onInsert: (question: string, options: PollOption[]) => void;
}) {
  const [question, setQuestion] = useState("");
  const [optionTexts, setOptionTexts] = useState(["", ""]);

  function addOption() {
    setOptionTexts([...optionTexts, ""]);
  }

  function removeOption(idx: number) {
    if (optionTexts.length <= 2) return;
    setOptionTexts(optionTexts.filter((_, i) => i !== idx));
  }

  function handleInsert() {
    const validOptions = optionTexts.filter((t) => t.trim());
    if (!question.trim() || validOptions.length < 2) return;

    const options: PollOption[] = validOptions.map((text, i) => ({
      id: `opt-${i}-${Date.now()}`,
      text: text.trim(),
      votes: 0,
    }));
    onInsert(question.trim(), options);
  }

  return (
    <Modal title="Insert Poll" onClose={onClose}>
      <div className="space-y-3">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Poll question"
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          autoFocus
        />
        {optionTexts.map((text, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => {
                const updated = [...optionTexts];
                updated[i] = e.target.value;
                setOptionTexts(updated);
              }}
              placeholder={`Option ${i + 1}`}
              className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
            {optionTexts.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="text-zinc-400 hover:text-red-500"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addOption}
          className="text-sm text-blue-500 hover:text-blue-600"
        >
          + Add option
        </button>
        <button
          type="button"
          onClick={handleInsert}
          disabled={!question.trim() || optionTexts.filter((t) => t.trim()).length < 2}
          className="rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
        >
          Insert Poll
        </button>
      </div>
    </Modal>
  );
}
