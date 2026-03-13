"use client";

import { useEffect, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot } from "lexical";

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

export type DraftSaveStatus = "idle" | "saving" | "saved";

interface DraftPluginProps {
  draftKey: string;
  onSaveStatusChange?: (status: DraftSaveStatus) => void;
}

const SAVED_DISPLAY_MS = 2000;

export function DraftPlugin({ draftKey, onSaveStatusChange }: DraftPluginProps) {
  const [editor] = useLexicalComposerContext();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      onSaveStatusChange?.("saving");

      timerRef.current = setTimeout(() => {
        const json = JSON.stringify(editorState.toJSON());
        writeDraft(draftKey, json);
        onSaveStatusChange?.("saved");

        savedTimerRef.current = setTimeout(() => {
          onSaveStatusChange?.("idle");
        }, SAVED_DISPLAY_MS);
      }, SAVE_DEBOUNCE_MS);
    });

    return () => {
      unregister();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, [editor, draftKey, onSaveStatusChange]);

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

/**
 * Button to clear the current draft from localStorage and reset the editor.
 * Must be rendered inside a LexicalComposer context.
 */
export function ClearDraftButton({ draftKey }: { draftKey: string }) {
  const [editor] = useLexicalComposerContext();
  const [hasDraft, setHasDraft] = useState(() => readDraft(draftKey) !== null);

  useEffect(() => {
    const unregister = editor.registerUpdateListener(() => {
      setHasDraft(readDraft(draftKey) !== null);
    });
    return unregister;
  }, [editor, draftKey]);

  if (!hasDraft) return null;

  return (
    <button
      type="button"
      onClick={() => {
        clearDraft(draftKey);
        editor.update(() => {
          $getRoot().clear();
        });
        setHasDraft(false);
      }}
      className="text-xs text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"
      title="Discard saved draft"
    >
      Clear draft
    </button>
  );
}
