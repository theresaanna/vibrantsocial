"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  type HeadingTagType,
} from "@lexical/rich-text";
import {
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
} from "@lexical/list";
import { $setBlocksType } from "@lexical/selection";
import { $findMatchingParent } from "@lexical/utils";
import { useEffect, useState, useCallback } from "react";
import { DropdownMenu, DropdownItem } from "../ui/DropdownMenu";

type BlockType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "number"
  | "check"
  | "quote";

const blockTypeNames: Record<BlockType, string> = {
  paragraph: "Normal",
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  bullet: "Bullet List",
  number: "Numbered List",
  check: "Check List",
  quote: "Quote",
};

export function BlockFormatDropdown() {
  const [editor] = useLexicalComposerContext();
  const [blockType, setBlockType] = useState<BlockType>("paragraph");

  const updateBlockType = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    const anchorNode = selection.anchor.getNode();
    const element =
      anchorNode.getKey() === "root"
        ? anchorNode
        : $findMatchingParent(anchorNode, (e) => {
            const parent = e.getParent();
            return parent !== null && parent.getKey() === "root";
          }) ?? anchorNode.getTopLevelElementOrThrow();

    if ($isHeadingNode(element)) {
      const tag = element.getTag();
      setBlockType(tag as BlockType);
    } else if ($isListNode(element)) {
      const listType = element.getListType();
      if (listType === "bullet") setBlockType("bullet");
      else if (listType === "number") setBlockType("number");
      else if (listType === "check") setBlockType("check");
    } else {
      const type = element.getType();
      if (type === "quote") setBlockType("quote");
      else setBlockType("paragraph");
    }
  }, []);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateBlockType();
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );
  }, [editor, updateBlockType]);

  function formatBlock(type: BlockType) {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      // When the selection anchor or focus points to the root node,
      // $setBlocksType converts ALL top-level blocks instead of just
      // the block at the cursor. Normalize to the specific child block.
      const root = $getRoot();
      const rootKey = root.getKey();
      if (selection.anchor.key === rootKey) {
        const idx = Math.min(selection.anchor.offset, root.getChildrenSize() - 1);
        const child = root.getChildAtIndex(idx);
        if (child) {
          selection.anchor.set(child.getKey(), 0, "element");
        }
      }
      if (selection.focus.key === rootKey) {
        const idx = Math.min(selection.focus.offset, root.getChildrenSize() - 1);
        const child = root.getChildAtIndex(idx);
        if (child) {
          selection.focus.set(child.getKey(), 0, "element");
        }
      }

      if (type === "paragraph") {
        $setBlocksType(selection, () => $createParagraphNode());
      } else if (type === "h1" || type === "h2" || type === "h3") {
        $setBlocksType(selection, () => $createHeadingNode(type as HeadingTagType));
      } else if (type === "quote") {
        $setBlocksType(selection, () => $createQuoteNode());
      }
    });

    if (type === "bullet") {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else if (type === "number") {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    } else if (type === "check") {
      editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
    }
  }

  return (
    <DropdownMenu trigger={<span className="min-w-[80px] text-left">{blockTypeNames[blockType]}</span>}>
      {(Object.keys(blockTypeNames) as BlockType[]).map((type) => (
        <DropdownItem
          key={type}
          label={blockTypeNames[type]}
          active={blockType === type}
          onClick={() => formatBlock(type)}
        />
      ))}
    </DropdownMenu>
  );
}
