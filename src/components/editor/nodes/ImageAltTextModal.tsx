"use client";

import { useState, useRef, useEffect } from "react";
import { Modal } from "../ui/Modal";

const MAX_ALT_TEXT_LENGTH = 500;

interface ImageAltTextModalProps {
  initialAltText: string;
  onApply: (altText: string) => void;
  onClose: () => void;
}

export function ImageAltTextModal({
  initialAltText,
  onApply,
  onClose,
}: ImageAltTextModalProps) {
  const [value, setValue] = useState(initialAltText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply(value);
  };

  return (
    <Modal title="Alt Text" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="alt-text-input" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Describe this image
          </label>
          <textarea
            ref={textareaRef}
            id="alt-text-input"
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, MAX_ALT_TEXT_LENGTH))}
            data-testid="alt-text-input"
            placeholder="A brief description of the image for accessibility"
            rows={3}
            className="resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <span className="self-end text-xs text-zinc-400 dark:text-zinc-500">
            {value.length}/{MAX_ALT_TEXT_LENGTH}
          </span>
        </div>

        <div className="flex justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            data-testid="alt-text-apply-button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </form>
    </Modal>
  );
}
