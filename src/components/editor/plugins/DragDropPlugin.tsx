"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getNodeByKey,
  $getRoot,
  COMMAND_PRIORITY_HIGH,
  DRAGOVER_COMMAND,
  DRAGSTART_COMMAND,
  DROP_COMMAND,
  type LexicalEditor,
} from "lexical";
import { useEffect, useRef } from "react";

const DRAG_DATA_FORMAT = "application/x-lexical-drag-node";

function getBlockElementAtY(
  editor: LexicalEditor,
  y: number
): { element: HTMLElement; lexicalKey: string; position: "before" | "after" } | null {
  const root = editor.getRootElement();
  if (!root) return null;

  const children = Array.from(root.children) as HTMLElement[];
  let closest: { element: HTMLElement; distance: number; position: "before" | "after" } | null = null;

  for (const child of children) {
    const rect = child.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const distance = Math.abs(y - midY);

    if (!closest || distance < closest.distance) {
      closest = {
        element: child,
        distance,
        position: y < midY ? "before" : "after",
      };
    }
  }

  if (!closest) return null;

  // Walk up from the DOM element to find the lexical node key
  let el: HTMLElement | null = closest.element;
  let lexicalKey: string | null = null;
  while (el && el !== root) {
    // Lexical stores node keys in a __lexicalKey_* data attribute or
    // in the internal __lexicalKey property on the DOM element
    const key = getKeyFromElement(el);
    if (key != null) {
      lexicalKey = key;
      break;
    }
    el = el.parentElement;
  }

  if (!lexicalKey) return null;

  return {
    element: closest.element,
    lexicalKey,
    position: closest.position,
  };
}

function getKeyFromElement(el: HTMLElement): string | null {
  // Lexical decorators use data-lexical-decorator="true" and the key is
  // on the parent span created by createDOM. The internal key is stored
  // as a property like `__lexicalKey_<editorKey>`.
  for (const prop of Object.keys(el)) {
    if (prop.startsWith("__lexicalKey_")) {
      return (el as unknown as Record<string, string>)[prop];
    }
  }
  return null;
}

let dropLineEl: HTMLElement | null = null;

function showDropLine(editor: LexicalEditor, target: HTMLElement, position: "before" | "after") {
  const root = editor.getRootElement();
  if (!root) return;

  if (!dropLineEl) {
    dropLineEl = document.createElement("div");
    dropLineEl.style.position = "absolute";
    dropLineEl.style.left = "0";
    dropLineEl.style.right = "0";
    dropLineEl.style.height = "2px";
    dropLineEl.style.background = "#3b82f6";
    dropLineEl.style.borderRadius = "1px";
    dropLineEl.style.pointerEvents = "none";
    dropLineEl.style.zIndex = "10";
    dropLineEl.dataset.testid = "drag-drop-indicator";
  }

  // Ensure the root is positioned so absolute children work
  const rootStyle = getComputedStyle(root);
  if (rootStyle.position === "static") {
    root.style.position = "relative";
  }

  if (dropLineEl.parentElement !== root) {
    root.appendChild(dropLineEl);
  }

  const rootRect = root.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  if (position === "before") {
    dropLineEl.style.top = `${targetRect.top - rootRect.top - 1}px`;
  } else {
    dropLineEl.style.top = `${targetRect.bottom - rootRect.top - 1}px`;
  }

  dropLineEl.style.display = "block";
}

function hideDropLine() {
  if (dropLineEl) {
    dropLineEl.style.display = "none";
  }
}

export function DragDropPlugin(): null {
  const [editor] = useLexicalComposerContext();
  const draggedNodeKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;

    function onDragEnd() {
      hideDropLine();
      draggedNodeKeyRef.current = null;
    }

    root.addEventListener("dragend", onDragEnd);

    const unregister = [
      editor.registerCommand(
        DRAGSTART_COMMAND,
        (event: DragEvent) => {
          // Check if the drag target is inside a decorator node (image/video)
          const target = event.target as HTMLElement;
          if (!target) return false;

          // Find the decorator wrapper
          const decoratorEl = target.closest("[data-lexical-decorator]");
          if (!decoratorEl) return false;

          // Find the node key from the decorator's parent DOM
          let el: HTMLElement | null = decoratorEl as HTMLElement;
          const rootEl = editor.getRootElement();
          let nodeKey: string | null = null;

          while (el && el !== rootEl) {
            const key = getKeyFromElement(el);
            if (key != null) {
              nodeKey = key;
              break;
            }
            el = el.parentElement;
          }

          if (!nodeKey) return false;

          draggedNodeKeyRef.current = nodeKey;

          if (event.dataTransfer) {
            event.dataTransfer.setData(DRAG_DATA_FORMAT, nodeKey);
            event.dataTransfer.effectAllowed = "move";

            // Use the image/video element as the drag ghost
            const mediaEl = decoratorEl.querySelector("img, video");
            if (mediaEl) {
              event.dataTransfer.setDragImage(mediaEl, 0, 0);
            }
          }

          return true;
        },
        COMMAND_PRIORITY_HIGH
      ),

      editor.registerCommand(
        DRAGOVER_COMMAND,
        (event: DragEvent) => {
          if (!draggedNodeKeyRef.current) return false;

          event.preventDefault();
          if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
          }

          const target = getBlockElementAtY(editor, event.clientY);
          if (target) {
            // Don't show drop line on the dragged element itself
            const draggedKey = draggedNodeKeyRef.current;
            if (target.lexicalKey === draggedKey) {
              hideDropLine();
              return true;
            }
            showDropLine(editor, target.element, target.position);
          }

          return true;
        },
        COMMAND_PRIORITY_HIGH
      ),

      editor.registerCommand(
        DROP_COMMAND,
        (event: DragEvent) => {
          hideDropLine();

          const draggedKey =
            event.dataTransfer?.getData(DRAG_DATA_FORMAT) ??
            draggedNodeKeyRef.current;

          if (!draggedKey) return false;

          event.preventDefault();
          draggedNodeKeyRef.current = null;

          const dropTarget = getBlockElementAtY(editor, event.clientY);
          if (!dropTarget) return false;

          // Don't drop on self
          if (dropTarget.lexicalKey === draggedKey) return true;

          editor.update(() => {
            const draggedNode = $getNodeByKey(draggedKey);
            if (!draggedNode) return;

            const targetNode = $getNodeByKey(dropTarget.lexicalKey);
            if (!targetNode) return;

            // Get the top-level parent of the target node (direct child of root)
            const root = $getRoot();
            let topLevelTarget = targetNode;
            while (topLevelTarget.getParent() !== root && topLevelTarget.getParent() != null) {
              topLevelTarget = topLevelTarget.getParent()!;
            }

            // Get the top-level parent of the dragged node
            let topLevelDragged = draggedNode;
            while (topLevelDragged.getParent() !== root && topLevelDragged.getParent() != null) {
              topLevelDragged = topLevelDragged.getParent()!;
            }

            // Don't drop on self after resolving parents
            if (topLevelTarget.getKey() === topLevelDragged.getKey()) return;

            // Remove from current position
            topLevelDragged.remove();

            // Insert at the target position
            if (dropTarget.position === "before") {
              topLevelTarget.insertBefore(topLevelDragged);
            } else {
              topLevelTarget.insertAfter(topLevelDragged);
            }
          });

          return true;
        },
        COMMAND_PRIORITY_HIGH
      ),
    ];

    return () => {
      root.removeEventListener("dragend", onDragEnd);
      unregister.forEach((fn) => fn());
      hideDropLine();
    };
  }, [editor]);

  return null;
}
