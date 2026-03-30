"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $insertNodes, $createParagraphNode } from "lexical";
import { useState, useCallback, useRef, useEffect } from "react";
import { GiphyFetch } from "@giphy/js-fetch-api";
import { Grid } from "@giphy/react-components";
import type { IGif } from "@giphy/js-types";
import { Modal } from "../ui/Modal";
import { $createImageNode } from "../nodes/ImageNode";

const btnClass =
  "rounded p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700";

const gf = new GiphyFetch(process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? "");

export function GifButton() {
  const [editor] = useLexicalComposerContext();
  const [modal, setModal] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setModal(true)}
        className={btnClass}
        aria-label="Insert GIF"
        title="Insert GIF"
      >
        <span className="text-[11px] font-bold leading-none" style={{ fontFamily: "ui-monospace, monospace" }}>GIF</span>
      </button>
      {modal && (
        <GifSearchModal
          onSelect={(gif) => {
            const url =
              gif.images.downsized_medium?.url ||
              gif.images.original?.url ||
              gif.images.downsized?.url;
            if (!url) return;
            editor.update(() => {
              const node = $createImageNode({
                src: url,
                altText: gif.title || "GIF",
              });
              $insertNodes([node, $createParagraphNode()]);
            });
            setModal(false);
          }}
          onClose={() => setModal(false)}
        />
      )}
    </>
  );
}

function GifSearchModal({
  onSelect,
  onClose,
}: {
  onSelect: (gif: IGif) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [gridKey, setGridKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(400);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Measure container width for the Grid component
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(Math.floor(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Debounce search query
  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
      setGridKey((k) => k + 1);
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const fetchGifs = useCallback(
    (offset: number) => {
      if (debouncedQuery) {
        return gf.search(debouncedQuery, { offset, limit: 20 });
      }
      return gf.trending({ offset, limit: 20 });
    },
    [debouncedQuery]
  );

  return (
    <Modal title="Insert GIF" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIFs..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-blue-400"
          autoFocus
        />
        <div
          ref={containerRef}
          className="-mx-1 max-h-[50vh] overflow-y-auto"
        >
          {containerWidth > 0 && (
            <Grid
              key={gridKey}
              width={containerWidth}
              columns={3}
              gutter={6}
              fetchGifs={fetchGifs}
              noLink
              hideAttribution
              onGifClick={(gif, e) => {
                e.preventDefault();
                onSelect(gif);
              }}
            />
          )}
        </div>
        <div className="flex items-center justify-center gap-1.5 pt-1 text-xs text-zinc-400">
          <span>Powered by</span>
          <svg
            viewBox="0 0 163 35"
            className="h-3.5"
            fill="currentColor"
            aria-label="GIPHY"
          >
            <path d="M4.17 19.86h6.46v5.53a10.3 10.3 0 01-6.23 2.11C1.8 27.5 0 24.5 0 18.31v-1.62C0 10.78 2.05 7.5 5.82 7.5c3.2 0 5.15 1.83 5.47 5.35H7.78c-.2-1.78-.77-2.6-2-2.6-1.56 0-2.24 1.5-2.24 5.44v3.24c0 4.04.63 5.83 2.37 5.83.6 0 1.27-.17 1.78-.45v-3.98H4.17v-2.47zm12.8-12.06h3.3v19.44h-3.3V7.8zm9.47 0h6.1c3.43 0 5.33 1.84 5.33 5.3 0 3.38-2.04 5.52-5.64 5.52h-2.5v8.62h-3.3V7.8zm3.3 8.22h1.85c1.83 0 2.77-.82 2.77-2.82 0-1.88-.78-2.83-2.42-2.83h-2.2v5.65zM44.34 7.8h3.3v7.85h5.14V7.8h3.29v19.44h-3.3v-9.02h-5.14v9.02h-3.3V7.8zm22.78 11.13v8.3h-3.38V7.8h3.38v8.13l4.47-8.14h3.5L70.43 16l5.05 11.24h-3.54l-4.82-8.32z" />
            <path
              fill="#00FF99"
              d="M78 0h6v35h-6z"
            />
            <path
              fill="#9933FF"
              d="M84 0h6v35h-6z"
            />
            <path
              fill="#00CCFF"
              d="M90 0h6v35h-6z"
            />
            <path
              fill="#FFF35C"
              d="M96 0h6v35h-6z"
            />
          </svg>
        </div>
      </div>
    </Modal>
  );
}
