"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey } from "lexical";
import { CollapsibleContainerNode } from "../nodes/CollapsibleNodes";

const DELETE_ATTR = "data-collapsible-delete";

function createDeleteButton(nodeKey: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.contentEditable = "false";
  btn.setAttribute(DELETE_ATTR, nodeKey);
  btn.setAttribute("aria-label", "Delete collapsible section");
  btn.className =
    "collapsible-delete-btn absolute top-1.5 right-1.5 z-10 rounded p-0.5 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 opacity-0 transition-opacity";
  btn.innerHTML = `<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>`;
  return btn;
}

/**
 * Adds a delete button to collapsible containers on hover.
 * Uses event delegation and update listener to ensure buttons persist.
 */
export function CollapsiblePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    // Track known collapsible container keys
    const containerKeys = new Set<string>();

    // Ensure delete buttons exist on all containers
    function ensureDeleteButtons() {
      for (const key of containerKeys) {
        const dom = editor.getElementByKey(key);
        if (!dom) continue;
        // Add relative positioning for absolute button placement
        if (!dom.classList.contains("relative")) {
          dom.classList.add("relative", "group/collapsible");
        }
        // Add button if missing
        if (!dom.querySelector(`[${DELETE_ATTR}]`)) {
          dom.appendChild(createDeleteButton(key));
        }
      }
    }

    // Watch for collapsible container mutations
    const unregisterMutation = editor.registerMutationListener(
      CollapsibleContainerNode,
      (mutations) => {
        for (const [key, type] of mutations) {
          if (type === "created") {
            containerKeys.add(key);
          } else if (type === "destroyed") {
            containerKeys.delete(key);
          }
        }
        ensureDeleteButtons();
      },
    );

    // Re-add buttons after each update in case reconciler removed them
    const unregisterUpdate = editor.registerUpdateListener(() => {
      ensureDeleteButtons();
    });

    // Handle delete clicks via event delegation
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const btn = target.closest(`[${DELETE_ATTR}]`) as HTMLElement | null;
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      const nodeKey = btn.getAttribute(DELETE_ATTR);
      if (!nodeKey) return;

      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node) node.remove();
      });
    }

    rootElement.addEventListener("click", handleClick);

    return () => {
      unregisterMutation();
      unregisterUpdate();
      rootElement.removeEventListener("click", handleClick);
    };
  }, [editor]);

  return null;
}
