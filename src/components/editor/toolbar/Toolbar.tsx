"use client";

import { UndoRedoButtons } from "./UndoRedoButtons";
import { BlockFormatDropdown } from "./BlockFormatDropdown";
import { FontDropdown } from "./FontDropdown";
import { FontSizeControls } from "./FontSizeControls";
import { TextFormatButtons } from "./TextFormatButtons";
import { LinkButton } from "./LinkButton";
import { ColorPicker } from "./ColorPicker";
import { AlignmentDropdown } from "./AlignmentDropdown";
import { InsertDropdown } from "./InsertDropdown";
import { SpeechToTextButton } from "./SpeechToTextButton";
import { ImportFileButton } from "./ImportFileButton";
import { LockButton } from "./LockButton";
import { MarkdownToggleButton } from "./MarkdownToggleButton";
import { Divider } from "./Divider";

export function Toolbar() {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 px-2 py-1 dark:border-zinc-700">
      <UndoRedoButtons />
      <Divider />
      <BlockFormatDropdown />
      <Divider />
      <FontDropdown />
      <FontSizeControls />
      <Divider />
      <TextFormatButtons />
      <Divider />
      <LinkButton />
      <ColorPicker type="text" />
      <ColorPicker type="background" />
      <Divider />
      <AlignmentDropdown />
      <Divider />
      <InsertDropdown />
      <Divider />
      <SpeechToTextButton />
      <ImportFileButton />
      <LockButton />
      <MarkdownToggleButton />
    </div>
  );
}
