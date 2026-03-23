"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { TextNode } from "lexical";
import { $createHashtagNode } from "../nodes/HashtagNode";

// Only match hashtags followed by whitespace or punctuation so we don't
// convert while the user is still typing (e.g. "#t" → HashtagNode too early).
const HASHTAG_REGEX = /(?<![a-zA-Z0-9])#([a-zA-Z0-9][a-zA-Z0-9-]{0,49})(?=[\s,.!?;:)\]}])/;

/**
 * Lexical plugin that converts plain-text #hashtags in TextNodes into
 * HashtagNode instances so they render as styled links. This handles
 * the case where a user typed "#tagname" without selecting from the
 * hashtag typeahead, so the hashtag was stored as a plain text node.
 */
export function HashtagLinkPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerNodeTransform(TextNode, (node) => {
      const text = node.getTextContent();
      const match = HASHTAG_REGEX.exec(text);
      if (!match) return;

      const hashtagStart = match.index;
      const hashtagLength = match[0].length;
      const tagName = match[1];

      let workingNode = node;
      if (hashtagStart > 0) {
        workingNode = workingNode.splitText(hashtagStart)[1];
      }

      const [hashtagTextNode, afterNode] =
        workingNode.splitText(hashtagLength);

      const hashtagNode = $createHashtagNode(tagName);
      hashtagTextNode.replace(hashtagNode);

      void afterNode;
    });
  }, [editor]);

  return null;
}
