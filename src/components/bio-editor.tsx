"use client";

import { Editor } from "@/components/editor/Editor";

interface BioEditorProps {
  initialContent?: string | null;
}

export function BioEditor({ initialContent }: BioEditorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Bio
      </label>
      <div className="mt-1">
        <Editor
          initialContent={initialContent}
          inputName="bio"
          placeholder="Tell us about yourself..."
          minHeight="188px"
        />
      </div>
    </div>
  );
}
