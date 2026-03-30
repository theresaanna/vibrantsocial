"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  FORMAT_TEXT_COMMAND,
  $getSelection,
  $isRangeSelection,
  type TextFormatType,
} from "lexical";
import { TOGGLE_LINK_COMMAND, $isLinkNode } from "@lexical/link";
import { $findMatchingParent } from "@lexical/utils";
import {
  $patchStyleText,
  $getSelectionStyleValueForProperty,
} from "@lexical/selection";
import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

const PRESET_COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc", "#ffffff",
  "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#0099ff", "#0000ff",
  "#9900ff", "#ff00ff", "#cc0000", "#cc7a00", "#cccc00", "#00cc00",
  "#007acc", "#0000cc", "#7a00cc", "#cc00cc",
];

interface MenuPosition {
  x: number;
  y: number;
}

export function ContextMenuPlugin() {
  const [editor] = useLexicalComposerContext();
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [activeFormats, setActiveFormats] = useState<Set<TextFormatType>>(
    new Set()
  );
  const [isLink, setIsLink] = useState(false);
  const [colorSubmenu, setColorSubmenu] = useState<
    "text" | "background" | null
  >(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const colorSubmenuRef = useRef<HTMLDivElement>(null);

  const readSelectionState = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const active = new Set<TextFormatType>();
      for (const fmt of [
        "bold",
        "italic",
        "underline",
        "strikethrough",
      ] as TextFormatType[]) {
        if (selection.hasFormat(fmt)) active.add(fmt);
      }
      setActiveFormats(active);

      const node = selection.anchor.getNode();
      const parent = node.getParent();
      setIsLink(
        $isLinkNode(parent) ||
          $isLinkNode(node) ||
          $findMatchingParent(node, $isLinkNode) !== null
      );
    });
  }, [editor]);

  // Handle right-click / ctrl+click on the editor
  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;

    function handleContextMenu(e: MouseEvent) {
      // Check if there is a non-collapsed selection
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || selection.isCollapsed()) return;

        e.preventDefault();
        setPosition({ x: e.clientX, y: e.clientY });
        setColorSubmenu(null);
      });
    }

    root.addEventListener("contextmenu", handleContextMenu);
    return () => root.removeEventListener("contextmenu", handleContextMenu);
  }, [editor]);

  // Update active format state whenever the menu opens
  useEffect(() => {
    if (position) {
      readSelectionState();
    }
  }, [position, readSelectionState]);

  // Close on click outside or escape
  useEffect(() => {
    if (!position) return;

    function handleMouseDown(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        (!colorSubmenuRef.current ||
          !colorSubmenuRef.current.contains(e.target as Node))
      ) {
        setPosition(null);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPosition(null);
      }
    }

    function handleScroll() {
      setPosition(null);
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [position]);

  function applyFormat(format: TextFormatType) {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    readSelectionState();
  }

  function handleLink() {
    if (isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    } else {
      const url = prompt("Enter URL:");
      if (url) {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
      }
    }
    setPosition(null);
  }

  function applyColor(type: "text" | "background", value: string) {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        if (type === "text") {
          $patchStyleText(selection, { color: value || null });
        } else {
          $patchStyleText(selection, { "background-color": value || null });
        }
      }
    });
    setColorSubmenu(null);
    setPosition(null);
  }

  if (!position) return null;

  // Clamp menu position to viewport
  const menuWidth = 200;
  const menuHeight = 280;
  const x = Math.min(position.x, window.innerWidth - menuWidth - 8);
  const y = Math.min(position.y, window.innerHeight - menuHeight - 8);

  const formatItems: {
    format: TextFormatType;
    label: string;
    shortcut: string;
    icon: React.ReactNode;
  }[] = [
    {
      format: "bold",
      label: "Bold",
      shortcut: "⌘B",
      icon: <span className="font-bold">B</span>,
    },
    {
      format: "italic",
      label: "Italic",
      shortcut: "⌘I",
      icon: <span className="italic">I</span>,
    },
    {
      format: "underline",
      label: "Underline",
      shortcut: "⌘U",
      icon: <span className="underline">U</span>,
    },
    {
      format: "strikethrough",
      label: "Strikethrough",
      shortcut: "",
      icon: <span className="line-through">S</span>,
    },
  ];

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[180px] rounded-lg border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {formatItems.map((item) => (
        <button
          key={item.format}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyFormat(item.format)}
          className={`flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
            activeFormats.has(item.format)
              ? "text-blue-600 dark:text-blue-400"
              : "text-zinc-700 dark:text-zinc-300"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center text-sm">
            {item.icon}
          </span>
          <span className="flex-1">{item.label}</span>
          {activeFormats.has(item.format) && (
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
          {item.shortcut && (
            <span className="text-xs text-zinc-400">{item.shortcut}</span>
          )}
        </button>
      ))}

      <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleLink}
        className={`flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
          isLink
            ? "text-blue-600 dark:text-blue-400"
            : "text-zinc-700 dark:text-zinc-300"
        }`}
      >
        <span className="flex h-5 w-5 items-center justify-center">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </span>
        <span className="flex-1">{isLink ? "Remove Link" : "Add Link"}</span>
      </button>

      <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />

      {/* Text Color */}
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            setColorSubmenu(colorSubmenu === "text" ? null : "text")
          }
          className="flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <span className="flex h-5 w-5 items-center justify-center">
            <span className="text-sm font-bold">A</span>
          </span>
          <span className="flex-1">Text Color</span>
          <svg
            className="h-3.5 w-3.5 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Background Color */}
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            setColorSubmenu(colorSubmenu === "background" ? null : "background")
          }
          className="flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <span className="flex h-5 w-5 items-center justify-center">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
              />
            </svg>
          </span>
          <span className="flex-1">Background Color</span>
          <svg
            className="h-3.5 w-3.5 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Color submenu */}
      {colorSubmenu && (
        <div
          ref={colorSubmenuRef}
          className="absolute left-full top-0 z-[10000] ml-1 w-[200px] rounded-lg border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
          style={{
            // If the submenu would go off-screen right, show it on the left
            ...(x + menuWidth + 210 > window.innerWidth
              ? { left: "auto", right: "100%", marginLeft: 0, marginRight: 4 }
              : {}),
          }}
        >
          <div className="mb-2 px-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {colorSubmenu === "text" ? "Text Color" : "Background Color"}
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyColor(colorSubmenu, c)}
                className="h-6 w-6 rounded border border-zinc-300 transition-transform hover:scale-110 dark:border-zinc-600"
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
            <input
              type="color"
              defaultValue="#000000"
              onChange={(e) => applyColor(colorSubmenu, e.target.value)}
              className="h-6 w-6 cursor-pointer appearance-none rounded border border-zinc-300 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-none dark:border-zinc-600"
              aria-label="Pick custom color"
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Custom
            </span>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyColor(colorSubmenu, "")}
              className="ml-auto text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
