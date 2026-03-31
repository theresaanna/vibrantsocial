"use client";

import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { useTypeahead } from "@/hooks/use-typeahead";
import { TypeaheadDropdown } from "@/components/typeahead-dropdown";

interface MentionInputProps {
  name: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  className?: string;
}

export interface MentionInputHandle {
  focus: () => void;
  clear: () => void;
}

/**
 * A plain text input with @mention and #hashtag typeahead support.
 * Shows a dropdown of user suggestions when @ is typed,
 * or tag suggestions when # is typed.
 */
export const MentionInput = forwardRef<MentionInputHandle, MentionInputProps>(
  function MentionInput({ name, placeholder, required, maxLength, className }, ref) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState("");

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      clear: () => setValue(""),
    }));

    const setValueStable = useCallback((v: string) => setValue(v), []);
    const typeahead = useTypeahead({
      value,
      setValue: setValueStable,
      inputRef,
    });

    return (
      <>
        <input
          ref={inputRef}
          name={name}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          onInput={typeahead.detectTrigger}
          onClick={typeahead.detectTrigger}
          onKeyDown={(e) => {
            typeahead.handleKeyDown(e);
          }}
          placeholder={placeholder}
          required={required}
          maxLength={maxLength}
          className={className}
          autoComplete="off"
          data-testid="mention-input"
        />
        {typeahead.isOpen && (
          <TypeaheadDropdown
            mode={typeahead.mode}
            mentionResults={typeahead.mentionResults}
            tagResults={typeahead.tagResults}
            selectedIndex={typeahead.selectedIndex}
            dropdownPos={typeahead.dropdownPos}
            dropdownRef={typeahead.dropdownRef}
            insertMention={typeahead.insertMention}
            insertHashtag={typeahead.insertHashtag}
          />
        )}
      </>
    );
  }
);
