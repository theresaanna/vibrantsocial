import type { Klass, LexicalNode } from "lexical";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { ListNode, ListItemNode } from "@lexical/list";
import { LinkNode, AutoLinkNode } from "@lexical/link";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { TableNode, TableCellNode, TableRowNode } from "@lexical/table";
import { ImageNode } from "./nodes/ImageNode";
import { YouTubeNode } from "./nodes/YouTubeNode";
import { EquationNode } from "./nodes/EquationNode";
import { PageBreakNode } from "./nodes/PageBreakNode";

import { StickyNoteNode } from "./nodes/StickyNoteNode";
import { PollNode } from "./nodes/PollNode";
import { DateNode } from "./nodes/DateNode";

import { VideoNode } from "./nodes/VideoNode";
import { FileNode } from "./nodes/FileNode";
import { MentionNode } from "./nodes/MentionNode";

export const editorNodes: Array<Klass<LexicalNode>> = [
  HeadingNode,
  QuoteNode,
  CodeNode,
  CodeHighlightNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  HorizontalRuleNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  ImageNode,
  YouTubeNode,
  EquationNode,
  PageBreakNode,

  StickyNoteNode,
  PollNode,
  DateNode,

  VideoNode,
  FileNode,
  MentionNode,
];
