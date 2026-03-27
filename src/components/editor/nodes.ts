import type { Klass, LexicalNode } from "lexical";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";

import { ListNode, ListItemNode } from "@lexical/list";
import { LinkNode, AutoLinkNode } from "@lexical/link";

import { TableNode, TableCellNode, TableRowNode } from "@lexical/table";
import { ImageNode } from "./nodes/ImageNode";
import { YouTubeNode } from "./nodes/YouTubeNode";
import { PageBreakNode } from "./nodes/PageBreakNode";


import { PollNode } from "./nodes/PollNode";
import { DateNode } from "./nodes/DateNode";

import { VideoNode } from "./nodes/VideoNode";
import { FileNode } from "./nodes/FileNode";
import { MentionNode } from "./nodes/MentionNode";
import { HashtagNode } from "./nodes/HashtagNode";

export const editorNodes: Array<Klass<LexicalNode>> = [
  HeadingNode,
  QuoteNode,

  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,

  TableNode,
  TableCellNode,
  TableRowNode,
  ImageNode,
  YouTubeNode,
  PageBreakNode,


  PollNode,
  DateNode,

  VideoNode,
  FileNode,
  MentionNode,
  HashtagNode,
];
