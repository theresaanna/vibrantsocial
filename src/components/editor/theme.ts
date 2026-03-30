import type { EditorThemeClasses } from "lexical";

export const editorTheme: EditorThemeClasses = {
  paragraph: "mb-1",
  heading: {
    h1: "text-2xl font-bold mb-2",
    h2: "text-xl font-bold mb-2",
    h3: "text-lg font-bold mb-1",
  },
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
    underlineStrikethrough: "underline line-through",

  },
  quote:
    "border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 italic text-zinc-600 dark:text-zinc-400 my-2",
  list: {
    nested: {
      listitem: "list-none",
    },
    ul: "list-disc ml-4 my-1",
    ol: "list-decimal ml-4 my-1",
    listitem: "my-0.5",
    listitemChecked:
      "line-through text-zinc-400 relative ml-2 list-none outline-none before:absolute before:-left-5 before:content-['✓'] before:text-green-500",
    listitemUnchecked:
      "relative ml-2 list-none outline-none before:absolute before:-left-5 before:content-['☐'] before:text-zinc-400",
  },
  link: "text-blue-600 dark:text-blue-400 underline cursor-pointer",
  table: "border-collapse w-full my-2",
  tableCell:
    "border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm min-w-[75px]",
  tableCellHeader:
    "border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm font-bold bg-zinc-100 dark:bg-zinc-800 min-w-[75px]",
  tableRow: "",

  image: "inline-block max-w-full",
  video: "my-2 inline-block max-w-full",
  file: "my-2 inline-block",
  embedBlock: {
    base: "my-2",
    focus: "outline-2 outline-blue-500",
  },
};
