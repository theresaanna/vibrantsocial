"use client";

import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

const DRAFT_PREFIX = "vibrant-draft:";
const SAVE_DEBOUNCE_MS = 3000;
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface DraftData {
  content: string;
  savedAt: number;
}

function getStorageKey(draftKey: string) {
  return `${DRAFT_PREFIX}${draftKey}`;
}

function readDraft(draftKey: string): string | null {
  try {
    const raw = localStorage.getItem(getStorageKey(draftKey));
    if (!raw) return null;
    const draft: DraftData = JSON.parse(raw);
    if (Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(getStorageKey(draftKey));
      return null;
    }
    return draft.content;
  } catch {
    return null;
  }
}

function writeDraft(draftKey: string, content: string) {
  try {
    const data: DraftData = { content, savedAt: Date.now() };
    localStorage.setItem(getStorageKey(draftKey), JSON.stringify(data));
  } catch {
    // localStorage full or unavailable
  }
}

/** Remove a draft from localStorage. Call after successful submission. */
export function clearDraft(draftKey: string) {
  try {
    localStorage.removeItem(getStorageKey(draftKey));
  } catch {
    // ignore
  }
}

interface DraftPluginProps {
  draftKey: string;
}

export function DraftPlugin({ draftKey }: DraftPluginProps) {
  const [editor] = useLexicalComposerContext();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMountedRef = useRef(false);

  // Restore draft on mount
  useEffect(() => {
    const saved = readDraft(draftKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.root?.type === "root") {
          const state = editor.parseEditorState(saved);
          editor.setEditorState(state);
        }
      } catch {
        // Invalid draft, ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced save on editor changes
  useEffect(() => {
    const unregister = editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      // Skip if nothing actually changed
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;

      // Skip the first real update (mount/restoration)
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return;
      }

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const json = JSON.stringify(editorState.toJSON());
        writeDraft(draftKey, json);
      }, SAVE_DEBOUNCE_MS);
    });

    return () => {
      unregister();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [editor, draftKey]);

  // Flush pending save on page hide/unload
  useEffect(() => {
    function flush() {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        const json = JSON.stringify(editor.getEditorState().toJSON());
        writeDraft(draftKey, json);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") flush();
    }

    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [editor, draftKey]);

  return null;
}
