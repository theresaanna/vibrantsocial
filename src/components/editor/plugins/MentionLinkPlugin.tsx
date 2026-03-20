"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { TextNode } from "lexical";
import { $createMentionNode } from "../nodes/MentionNode";

const MENTION_REGEX = /(?<![a-zA-Z0-9])@([a-zA-Z0-9_]{3,30})/;

/**
 * Lexical plugin that converts plain-text @mentions in TextNodes into
 * MentionNode instances so they render as styled links.  This handles
 * the case where a user typed "@username" without selecting from the
 * mention typeahead, so the mention was stored as a plain text node.
 */
export function MentionLinkPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerNodeTransform(TextNode, (node) => {
      const text = node.getTextContent();
      const match = MENTION_REGEX.exec(text);
      if (!match) return;

      const mentionStart = match.index;
      const mentionLength = match[0].length;
      const username = match[1];

      // Split: [before] [mention] [after]
      let workingNode = node;
      if (mentionStart > 0) {
        workingNode = workingNode.splitText(mentionStart)[1];
      }

      const [mentionTextNode, afterNode] =
        workingNode.splitText(mentionLength);

      const mentionNode = $createMentionNode(username);
      mentionTextNode.replace(mentionNode);

      // If there's text after, the transform will re-fire on it
      void afterNode;
    });
  }, [editor]);

  return null;
}
