"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey, $getRoot, type LexicalEditor } from "lexical";
import { useEffect, useRef } from "react";

/**
 * Data attribute set on draggable media wrappers (ImageComponent, VideoComponent)
 * so this plugin can identify the Lexical node key from the DOM.
 */
export const DRAG_NODE_KEY_ATTR = "data-drag-node-key";

function getBlockElementAtY(
  editor: LexicalEditor,
  y: number
): { element: HTMLElement; lexicalKey: string; position: "before" | "after" } | null {
  const root = editor.getRootElement();
  if (!root) return null;

  const children = Array.from(root.children) as HTMLElement[];
  let closest: {
    element: HTMLElement;
    distance: number;
    position: "before" | "after";
  } | null = null;

  for (const child of children) {
    const rect = child.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const distance = Math.abs(y - midY);

    if (!closest || distance < closest.distance) {
      closest = { element: child, distance, position: y < midY ? "before" : "after" };
    }
  }

  if (!closest) return null;

  // Find the Lexical node key on the closest block element.
  // Lexical sets __lexicalKey_<namespace> as an own property on DOM nodes it creates.
  const key = getLexicalKeyFromDom(closest.element, root);
  if (!key) return null;

  return { element: closest.element, lexicalKey: key, position: closest.position };
}

function getLexicalKeyFromDom(el: HTMLElement, root: HTMLElement): string | null {
  let current: HTMLElement | null = el;
  while (current && current !== root) {
    for (const prop of Object.keys(current)) {
      if (prop.startsWith("__lexicalKey_")) {
        return (current as unknown as Record<string, string>)[prop];
      }
    }
    current = current.parentElement;
  }
  return null;
}

let dropLineEl: HTMLElement | null = null;

function showDropLine(root: HTMLElement, target: HTMLElement, position: "before" | "after") {
  if (!dropLineEl) {
    dropLineEl = document.createElement("div");
    dropLineEl.style.cssText =
      "position:absolute;left:0;right:0;height:2px;background:#3b82f6;border-radius:1px;pointer-events:none;z-index:10";
    dropLineEl.dataset.testid = "drag-drop-indicator";
  }

  if (getComputedStyle(root).position === "static") {
    root.style.position = "relative";
  }

  if (dropLineEl.parentElement !== root) {
    root.appendChild(dropLineEl);
  }

  const rootRect = root.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  dropLineEl.style.top =
    position === "before"
      ? `${targetRect.top - rootRect.top - 1}px`
      : `${targetRect.bottom - rootRect.top - 1}px`;

  dropLineEl.style.display = "block";
}

function hideDropLine() {
  if (dropLineEl) dropLineEl.style.display = "none";
}

export function DragDropPlugin(): null {
  const [editor] = useLexicalComposerContext();
  const draggedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;

    function onDragStart(e: DragEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Walk up to find our data attribute that marks draggable media
      const wrapper = target.closest(`[${DRAG_NODE_KEY_ATTR}]`) as HTMLElement | null;
      if (!wrapper) return;

      const nodeKey = wrapper.getAttribute(DRAG_NODE_KEY_ATTR);
      if (!nodeKey) return;

      draggedKeyRef.current = nodeKey;

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        // Set a transparent drag image from the media element
        const mediaEl = wrapper.querySelector("img, video") as HTMLElement | null;
        if (mediaEl) {
          e.dataTransfer.setDragImage(mediaEl, 0, 0);
        }
      }
    }

    function onDragOver(e: DragEvent) {
      if (!draggedKeyRef.current) return;

      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";

      const target = getBlockElementAtY(editor, e.clientY);
      if (!target || target.lexicalKey === draggedKeyRef.current) {
        hideDropLine();
        return;
      }

      showDropLine(root!, target.element, target.position);
    }

    function onDrop(e: DragEvent) {
      hideDropLine();

      const draggedKey = draggedKeyRef.current;
      if (!draggedKey) return;

      e.preventDefault();
      draggedKeyRef.current = null;

      const dropTarget = getBlockElementAtY(editor, e.clientY);
      if (!dropTarget || dropTarget.lexicalKey === draggedKey) return;

      editor.update(() => {
        const draggedNode = $getNodeByKey(draggedKey);
        if (!draggedNode) return;

        const targetNode = $getNodeByKey(dropTarget.lexicalKey);
        if (!targetNode) return;

        // Resolve to top-level (direct child of root)
        const root = $getRoot();

        let topDragged = draggedNode;
        while (topDragged.getParent() !== root && topDragged.getParent() != null) {
          topDragged = topDragged.getParent()!;
        }

        let topTarget = targetNode;
        while (topTarget.getParent() !== root && topTarget.getParent() != null) {
          topTarget = topTarget.getParent()!;
        }

        if (topTarget.getKey() === topDragged.getKey()) return;

        topDragged.remove();

        if (dropTarget.position === "before") {
          topTarget.insertBefore(topDragged);
        } else {
          topTarget.insertAfter(topDragged);
        }
      });
    }

    function onDragEnd() {
      hideDropLine();
      draggedKeyRef.current = null;
    }

    root.addEventListener("dragstart", onDragStart);
    root.addEventListener("dragover", onDragOver);
    root.addEventListener("drop", onDrop);
    root.addEventListener("dragend", onDragEnd);

    return () => {
      root.removeEventListener("dragstart", onDragStart);
      root.removeEventListener("dragover", onDragOver);
      root.removeEventListener("drop", onDrop);
      root.removeEventListener("dragend", onDragEnd);
      hideDropLine();
    };
  }, [editor]);

  return null;
}
