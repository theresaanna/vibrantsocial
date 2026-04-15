"use client";

import { useState } from "react";
import {
  attachDigitalFile,
  removeDigitalFile,
} from "@/app/marketplace/digital-file-actions";

interface DigitalFileEditorProps {
  marketplacePostId: string;
  fileName: string;
  fileSize: number;
  isFree: boolean;
}

export function DigitalFileEditor({
  marketplacePostId,
  fileName: initialFileName,
  fileSize: initialFileSize,
  isFree: initialIsFree,
}: DigitalFileEditorProps) {
  const [fileName, setFileName] = useState(initialFileName);
  const [fileSize, setFileSize] = useState(initialFileSize);
  const [isFree, setIsFree] = useState(initialIsFree);
  const [hasFile, setHasFile] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleDelete() {
    setIsDeleting(true);
    setError("");
    setSuccess("");
    const result = await removeDigitalFile(marketplacePostId);
    setIsDeleting(false);
    if (result.success) {
      setHasFile(false);
      setSuccess("File removed");
    } else {
      setError(result.message);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) {
      setError("File must be under 200MB");
      return;
    }

    setIsUploading(true);
    setError("");
    setSuccess("");

    try {
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload/digital-file",
        clientPayload: "digital-file",
      });

      const result = await attachDigitalFile(
        marketplacePostId,
        blob.url,
        file.name,
        file.size,
        isFree,
      );

      if (result.success) {
        setFileName(file.name);
        setFileSize(file.size);
        setHasFile(true);
        setSuccess("File replaced");
      } else {
        setError(result.message);
      }
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="mx-4 mb-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 dark:border-indigo-800 dark:bg-indigo-950/30">
      <div className="flex items-center gap-2">
        <svg
          className="h-4 w-4 shrink-0 text-indigo-500"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <span className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
          Digital File
        </span>
      </div>

      {hasFile ? (
        <div className="mt-2 flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
          <svg
            className="h-5 w-5 shrink-0 text-indigo-500"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {fileName}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {formatFileSize(fileSize)}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <label
              className={`cursor-pointer rounded-md border border-indigo-200 px-2.5 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-100 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/40 ${isUploading ? "pointer-events-none opacity-50" : ""}`}
              title="Replace file"
            >
              {isUploading ? "Uploading..." : "Replace"}
              <input
                type="file"
                className="hidden"
                onChange={handleUpload}
                disabled={isUploading}
              />
            </label>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || isUploading}
              className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
              title="Delete file"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      ) : (
        <label
          className={`mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-500 transition-colors hover:border-indigo-400 hover:text-indigo-500 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400 ${isUploading ? "pointer-events-none opacity-50" : ""}`}
        >
          {isUploading ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Uploading...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload new file
            </>
          )}
          <input
            type="file"
            className="hidden"
            onChange={handleUpload}
            disabled={isUploading}
          />
        </label>
      )}

      {error && (
        <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {success && (
        <p className="mt-1.5 text-xs text-green-600 dark:text-green-400">{success}</p>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
