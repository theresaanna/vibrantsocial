"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { GiphyFetch } from "@giphy/js-fetch-api";
import { Grid } from "@giphy/react-components";
import type { IGif } from "@giphy/js-types";
import { Modal } from "../ui/Modal";

const gf = new GiphyFetch(process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? "");

export function GifSearchModal({
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
        <p className="pt-1 text-center text-xs text-zinc-400">Powered by GIPHY</p>
      </div>
    </Modal>
  );
}
