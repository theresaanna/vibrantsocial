"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $insertNodes, $createParagraphNode } from "lexical";
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode";
import {
  INSERT_TABLE_COMMAND,
  type InsertTableCommandPayload,
} from "@lexical/table";
import { useState, useRef, type ChangeEvent } from "react";
import { DropdownMenu, DropdownItem } from "../ui/DropdownMenu";
import { Modal } from "../ui/Modal";
import { $createImageNode } from "../nodes/ImageNode";
import { $createVideoNode } from "../nodes/VideoNode";
import { $createFileNode } from "../nodes/FileNode";
import { $createYouTubeNode } from "../nodes/YouTubeNode";
import { $createEquationNode } from "../nodes/EquationNode";
import { $createPageBreakNode } from "../nodes/PageBreakNode";
import { $createCollapsibleWithDefaults } from "../nodes/CollapsibleNodes";
import { $createStickyNoteNode } from "../nodes/StickyNoteNode";
import { $createPollNode, type PollOption } from "../nodes/PollNode";
import { $createDateNode } from "../nodes/DateNode";
import { $createExcalidrawNode } from "../nodes/ExcalidrawNode";
import { extractYouTubeVideoID } from "../utils/url";
import { upload } from "@vercel/blob/client";

type ModalType =
  | "image"
  | "video"
  | "file"
  | "youtube"
  | "equation"
  | "table"
  | "poll"
  | null;

export function InsertDropdown() {
  const [editor] = useLexicalComposerContext();
  const [modal, setModal] = useState<ModalType>(null);

  function insertHorizontalRule() {
    editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
  }

  function insertPageBreak() {
    editor.update(() => {
      const node = $createPageBreakNode();
      $insertNodes([node, $createParagraphNode()]);
    });
  }

  function insertCollapsible() {
    editor.update(() => {
      const container = $createCollapsibleWithDefaults();
      $insertNodes([container, $createParagraphNode()]);
    });
  }

  function insertStickyNote() {
    editor.update(() => {
      const node = $createStickyNoteNode();
      $insertNodes([node, $createParagraphNode()]);
    });
  }

  function insertDate() {
    editor.update(() => {
      const node = $createDateNode();
      $insertNodes([node]);
    });
  }

  function insertExcalidraw() {
    editor.update(() => {
      const node = $createExcalidrawNode();
      $insertNodes([node, $createParagraphNode()]);
    });
  }

  return (
    <>
      <DropdownMenu
        trigger={
          <span className="flex items-center gap-1">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs">Insert</span>
          </span>
        }
      >
        <DropdownItem label="Horizontal Rule" onClick={insertHorizontalRule} />
        <DropdownItem label="Page Break" onClick={insertPageBreak} />
        <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
        <DropdownItem label="Image" onClick={() => setModal("image")} />
        <DropdownItem label="Video" onClick={() => setModal("video")} />
        <DropdownItem label="File / PDF" onClick={() => setModal("file")} />
        <DropdownItem label="YouTube Video" onClick={() => setModal("youtube")} />
        <DropdownItem label="Excalidraw" onClick={insertExcalidraw} />
        <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
        <DropdownItem label="Table" onClick={() => setModal("table")} />
        <DropdownItem label="Poll" onClick={() => setModal("poll")} />
        <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
        <DropdownItem label="Equation" onClick={() => setModal("equation")} />
        <DropdownItem label="Collapsible" onClick={insertCollapsible} />
        <DropdownItem label="Sticky Note" onClick={insertStickyNote} />
        <DropdownItem label="Date" onClick={insertDate} />
      </DropdownMenu>

      {modal === "image" && (
        <ImageInsertModal
          onClose={() => setModal(null)}
          onInsert={(src, alt) => {
            editor.update(() => {
              const node = $createImageNode({ src, altText: alt });
              $insertNodes([node, $createParagraphNode()]);
            });
            setModal(null);
          }}
        />
      )}

      {modal === "video" && (
        <VideoInsertModal
          onClose={() => setModal(null)}
          onInsert={(src, fileName, mimeType) => {
            editor.update(() => {
              const node = $createVideoNode({ src, fileName, mimeType });
              $insertNodes([node, $createParagraphNode()]);
            });
            setModal(null);
          }}
        />
      )}

      {modal === "file" && (
        <FileInsertModal
          onClose={() => setModal(null)}
          onInsert={(src, fileName, fileSize, mimeType) => {
            editor.update(() => {
              const node = $createFileNode({ src, fileName, fileSize, mimeType });
              $insertNodes([node, $createParagraphNode()]);
            });
            setModal(null);
          }}
        />
      )}

      {modal === "youtube" && (
        <YouTubeInsertModal
          onClose={() => setModal(null)}
          onInsert={(videoID) => {
            editor.update(() => {
              const node = $createYouTubeNode(videoID);
              $insertNodes([node, $createParagraphNode()]);
            });
            setModal(null);
          }}
        />
      )}

      {modal === "equation" && (
        <EquationInsertModal
          onClose={() => setModal(null)}
          onInsert={(equation, inline) => {
            editor.update(() => {
              const node = $createEquationNode(equation, inline);
              $insertNodes([node]);
            });
            setModal(null);
          }}
        />
      )}

      {modal === "table" && (
        <TableInsertModal
          onClose={() => setModal(null)}
          onInsert={(rows, cols) => {
            editor.dispatchCommand(INSERT_TABLE_COMMAND, {
              rows: String(rows),
              columns: String(cols),
              includeHeaders: true,
            } as InsertTableCommandPayload);
            setModal(null);
          }}
        />
      )}

      {modal === "poll" && (
        <PollInsertModal
          onClose={() => setModal(null)}
          onInsert={(question, options) => {
            editor.update(() => {
              const node = $createPollNode(question, options);
              $insertNodes([node, $createParagraphNode()]);
            });
            setModal(null);
          }}
        />
      )}
    </>
  );
}

/* ── Image Insert Modal ───────────────────────────── */
function ImageInsertModal({
  onClose,
  onInsert,
}: {
  onClose: () => void;
  onInsert: (src: string, alt: string) => void;
}) {
  const [mode, setMode] = useState<"url" | "upload">("upload");
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileUpload(file: File) {
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }
      const { url: uploadedUrl } = await res.json();
      onInsert(uploadedUrl, alt || file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal title="Insert Image" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`rounded px-3 py-1 text-sm ${
              mode === "upload"
                ? "bg-zinc-200 dark:bg-zinc-700"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            Upload
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`rounded px-3 py-1 text-sm ${
              mode === "url"
                ? "bg-zinc-200 dark:bg-zinc-700"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            URL
          </button>
        </div>

        {mode === "upload" ? (
          <FilePickerArea
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/heic,image/heif,.heic,.heif"
            hint="JPEG, PNG, GIF, WebP, SVG, HEIC, HEIF (max 5MB)"
            icon="image"
            uploading={uploading}
            onFileSelect={(file) => handleFileUpload(file)}
          />
        ) : (
          <div className="space-y-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
            <input
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Alt text (optional)"
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
            <button
              type="button"
              onClick={() => {
                if (url) onInsert(url, alt || "Image");
              }}
              disabled={!url}
              className="rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
            >
              Insert
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}

/* ── Video Insert Modal ───────────────────────────── */
function VideoInsertModal({
  onClose,
  onInsert,
}: {
  onClose: () => void;
  onInsert: (src: string, fileName: string, mimeType: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileUpload(file: File) {
    setError("");
    if (!file.type.startsWith("video/")) {
      setError("Please select a video file");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Video must be under 50MB");
      return;
    }

    setUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload/client",
        clientPayload: "video",
      });
      onInsert(blob.url, file.name, file.type);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal title="Insert Video" onClose={onClose}>
      <div className="space-y-3">
        <FilePickerArea
          accept="video/mp4,video/webm,video/quicktime,video/ogg,.mp4,.webm,.mov,.ogv"
          hint="MP4, WebM, MOV, OGG (max 50MB)"
          icon="video"
          uploading={uploading}
          onFileSelect={(file) => handleFileUpload(file)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}

/* ── File Insert Modal ────────────────────────────── */
function FileInsertModal({
  onClose,
  onInsert,
}: {
  onClose: () => void;
  onInsert: (src: string, fileName: string, fileSize: number, mimeType: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileUpload(file: File) {
    setError("");
    if (file.type !== "application/pdf") {
      setError("Please select a PDF file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File must be under 10MB");
      return;
    }

    setUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload/client",
        clientPayload: "document",
      });
      onInsert(blob.url, file.name, file.size, file.type);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal title="Insert File" onClose={onClose}>
      <div className="space-y-3">
        <FilePickerArea
          accept="application/pdf,.pdf"
          hint="PDF (max 10MB)"
          icon="file"
          uploading={uploading}
          onFileSelect={(file) => handleFileUpload(file)}
        />
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

/* ── Styled File Picker ──────────────────────────── */
function FilePickerArea({
  accept,
  hint,
  icon,
  uploading,
  onFileSelect,
}: {
  accept: string;
  hint: string;
  icon: "image" | "video" | "file";
  uploading: boolean;
  onFileSelect: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  }

  const iconPath =
    icon === "image"
      ? "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      : icon === "video"
        ? "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        : "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z";

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
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
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
        <span className="text-sm font-medium">
          {uploading ? "Uploading..." : "Choose a file"}
        </span>
      </button>
      <p className="mt-2 text-center text-xs text-zinc-400">{hint}</p>
    </div>
  );
}
