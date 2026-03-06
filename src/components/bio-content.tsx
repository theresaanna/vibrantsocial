"use client";

import { EditorContent } from "@/components/editor/EditorContent";

interface BioContentProps {
  content: string;
}

export function BioContent({ content }: BioContentProps) {
  return <EditorContent content={content} />;
}
