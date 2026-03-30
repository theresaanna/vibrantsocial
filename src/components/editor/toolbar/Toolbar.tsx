"use client";

import { UndoRedoButtons } from "./UndoRedoButtons";
import { BlockFormatDropdown } from "./BlockFormatDropdown";

import { FontSizeControls } from "./FontSizeControls";
import { TextFormatButtons } from "./TextFormatButtons";
import { LinkButton } from "./LinkButton";
import { ColorPicker } from "./ColorPicker";
import { AlignmentDropdown } from "./AlignmentDropdown";
import {
  FileUploadButton,

  YouTubeButton,
  TableButton,
  PollButton,
} from "./InsertButtons";
import { GifButton } from "./GifButton";
import { SpeechToTextButton } from "./SpeechToTextButton";

import { MarkdownToggleButton } from "./MarkdownToggleButton";
import { Divider } from "./Divider";

export function Toolbar() {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 px-2 py-1 dark:border-zinc-700">
      <UndoRedoButtons />
      <span className="hidden sm:contents">
        <BlockFormatDropdown />
        <FontSizeControls />
        <Divider />
      </span>
      <TextFormatButtons />
      <Divider />
      <LinkButton />
      <ColorPicker type="text" />
      <span className="hidden sm:contents">
        <ColorPicker type="background" />
        <Divider />
        <AlignmentDropdown />
      </span>
      <Divider />
      <FileUploadButton />
      <YouTubeButton />
      <GifButton />
      <span className="hidden sm:contents">
        <TableButton />
      </span>
      <PollButton />
      <SpeechToTextButton />
      <span className="hidden sm:contents">
        <Divider />
        <MarkdownToggleButton />
      </span>
    </div>
  );
}
