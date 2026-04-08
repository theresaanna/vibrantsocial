"use client";

import { useState } from "react";
import {
  downloadFreeFile,
  redeemCouponAndDownload,
  regenerateCouponCode,
} from "@/app/marketplace/digital-file-actions";

interface DigitalFileDownloadProps {
  marketplacePostId: string;
  fileName: string;
  fileSize: number;
  isFree: boolean;
  isOwner: boolean;
  couponCode?: string;
  downloadCount?: number;
}

export function DigitalFileDownload({
  marketplacePostId,
  fileName,
  fileSize,
  isFree,
  isOwner,
  couponCode: initialCouponCode,
  downloadCount: initialDownloadCount,
}: DigitalFileDownloadProps) {
  const [couponInput, setCouponInput] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [couponCode, setCouponCode] = useState(initialCouponCode);
  const [downloadCount, setDownloadCount] = useState(initialDownloadCount ?? 0);
  const [copiedCoupon, setCopiedCoupon] = useState(false);

  async function handleFreeDownload() {
    setIsLoading(true);
    setError("");
    const result = await downloadFreeFile(marketplacePostId);
    setIsLoading(false);

    if (result.success && result.downloadUrl) {
      setDownloadCount((c) => c + 1);
      triggerDownload(result.downloadUrl, result.fileName ?? fileName);
    } else {
      setError(result.message);
    }
  }

  async function handleCouponRedeem() {
    if (!couponInput.trim()) {
      setError("Please enter a coupon code");
      return;
    }

    setIsLoading(true);
    setError("");
    const result = await redeemCouponAndDownload(marketplacePostId, couponInput);
    setIsLoading(false);

    if (result.success && result.downloadUrl) {
      setDownloadCount((c) => c + 1);
      setCouponInput("");
      triggerDownload(result.downloadUrl, result.fileName ?? fileName);
    } else {
      setError(result.message);
    }
  }

  async function handleRegenerate() {
    setIsLoading(true);
    setError("");
    const result = await regenerateCouponCode(marketplacePostId);
    setIsLoading(false);

    if (result.success && result.couponCode) {
      setCouponCode(result.couponCode);
    } else {
      setError(result.message);
    }
  }

  async function handleCopyCoupon() {
    if (!couponCode) return;
    await navigator.clipboard.writeText(couponCode);
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 2000);
  }

  return (
    <div
      className="mx-4 mb-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 dark:border-indigo-800 dark:bg-indigo-950/30"
      data-testid="digital-file-section"
    >
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
        {isFree && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Free
          </span>
        )}
        {!isFree && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Coupon required
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {fileName} ({formatFileSize(fileSize)})
      </p>

      {/* Owner view: show coupon management */}
      {isOwner && !isFree && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Coupon:
            </span>
            <code
              className="rounded bg-white px-2 py-0.5 font-mono text-xs text-indigo-700 dark:bg-zinc-800 dark:text-indigo-300"
              data-testid="owner-coupon-code"
            >
              {couponCode}
            </code>
            <button
              type="button"
              onClick={handleCopyCoupon}
              className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              data-testid="copy-coupon-button"
            >
              {copiedCoupon ? "Copied!" : "Copy"}
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isLoading}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              data-testid="regenerate-coupon-button"
            >
              Regenerate
            </button>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Downloads: {downloadCount}
          </p>
        </div>
      )}

      {/* Owner view for free file */}
      {isOwner && isFree && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Downloads: {downloadCount}
        </p>
      )}

      {/* Non-owner: free download */}
      {!isOwner && isFree && (
        <button
          type="button"
          onClick={handleFreeDownload}
          disabled={isLoading}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-400 disabled:opacity-50"
          data-testid="free-download-button"
        >
          {isLoading ? "Downloading..." : "Download"}
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
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </button>
      )}

      {/* Non-owner: coupon-locked download */}
      {!isOwner && !isFree && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={couponInput}
            onChange={(e) => {
              setCouponInput(e.target.value);
              setError("");
            }}
            placeholder="Enter coupon code"
            className="w-40 rounded-md border border-indigo-200 px-2.5 py-1.5 font-mono text-sm uppercase text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none dark:border-indigo-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            data-testid="coupon-input"
          />
          <button
            type="button"
            onClick={handleCouponRedeem}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-400 disabled:opacity-50"
            data-testid="redeem-coupon-button"
          >
            {isLoading ? "Redeeming..." : "Redeem & Download"}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-xs text-red-600 dark:text-red-400" data-testid="digital-file-error">
          {error}
        </p>
      )}
    </div>
  );
}

function triggerDownload(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
