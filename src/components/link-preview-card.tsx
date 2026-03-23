"use client";

import { useEffect, useState } from "react";
import {
  fetchLinkPreview,
  type LinkPreviewData,
} from "@/app/feed/link-preview-action";

interface LinkPreviewCardProps {
  url: string;
}

export function LinkPreviewCard({ url }: LinkPreviewCardProps) {
  const [data, setData] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLinkPreview(url).then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="mt-3 animate-pulse rounded-lg border border-zinc-200 dark:border-zinc-700">
        <div className="flex gap-3 p-3">
          <div className="h-16 w-16 flex-shrink-0 rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hostname = (() => {
    try {
      return new URL(data.url).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  })();

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 block overflow-hidden rounded-lg border border-zinc-200 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
    >
      {data.image && (
        <div className="relative h-40 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 sm:h-48">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {data.favicon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.favicon}
              alt=""
              className="h-4 w-4 rounded-sm"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <span>{data.siteName || hostname}</span>
        </div>
        {data.title && (
          <p className="mt-1 text-sm font-medium leading-snug text-zinc-900 dark:text-zinc-100">
            {data.title.length > 100
              ? data.title.slice(0, 100) + "\u2026"
              : data.title}
          </p>
        )}
        {data.description && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {data.description}
          </p>
        )}
      </div>
    </a>
  );
}
