"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  KEY_DOWN_COMMAND,
  PASTE_COMMAND,
  DROP_COMMAND,
  DRAGSTART_COMMAND,
  CUT_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
} from "lexical";

/**
 * Blocks all text-editing operations (typing, paste, cut, drag/drop)
 * while keeping the editor technically "editable" so CheckListPlugin
 * can toggle checkboxes via click events.
 */
export function ReadOnlyChecklistPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const unregister = [
      editor.registerCommand(KEY_DOWN_COMMAND, () => true, COMMAND_PRIORITY_CRITICAL),
      editor.registerCommand(PASTE_COMMAND, () => true, COMMAND_PRIORITY_CRITICAL),
      editor.registerCommand(DROP_COMMAND, () => true, COMMAND_PRIORITY_CRITICAL),
      editor.registerCommand(DRAGSTART_COMMAND, () => true, COMMAND_PRIORITY_CRITICAL),
      editor.registerCommand(CUT_COMMAND, () => true, COMMAND_PRIORITY_CRITICAL),
    ];

    // Block beforeinput events to prevent mobile keyboards and IME
    const root = editor.getRootElement();
    const handleBeforeInput = (e: Event) => e.preventDefault();
    root?.addEventListener("beforeinput", handleBeforeInput);

    return () => {
      unregister.forEach((fn) => fn());
      root?.removeEventListener("beforeinput", handleBeforeInput);
    };
  }, [editor]);

  return null;
}
