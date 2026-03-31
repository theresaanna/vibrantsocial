"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $insertNodes, $createParagraphNode } from "lexical";
import { useState, lazy, Suspense } from "react";
import type { IGif } from "@giphy/js-types";
import { $createImageNode } from "../nodes/ImageNode";

const LazyGifSearchModal = lazy(() =>
  import("./GifSearchModal").then((m) => ({ default: m.GifSearchModal }))
);

const btnClass =
  "rounded p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700";

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
        <Suspense fallback={null}>
          <LazyGifSearchModal
            onSelect={(gif: IGif) => {
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
        </Suspense>
      )}
    </>
  );
}
