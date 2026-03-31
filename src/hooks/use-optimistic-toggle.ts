import { useState, useRef, useTransition, useEffect } from "react";
import type { ActionState } from "@/lib/action-utils";

/**
 * Manages an optimistic boolean toggle with a count, rolling back on failure.
 *
 * @param serverValue - Current value from the server (e.g. isLiked)
 * @param serverCount - Current count from the server (e.g. likeCount)
 * @param action - Server action to call. Receives a FormData with the provided entries.
 * @param formEntries - Key-value pairs to include in the FormData (e.g. { postId: "abc" })
 */
export function useOptimisticToggle(
  serverValue: boolean,
  serverCount: number,
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>,
  formEntries: Record<string, string>
) {
  const [value, setValue] = useState(serverValue);
  const [count, setCount] = useState(serverCount);
  const inFlight = useRef(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setValue(serverValue);
  }, [serverValue]);

  useEffect(() => {
    setCount(serverCount);
  }, [serverCount]);

  const handleToggle = () => {
    if (inFlight.current) return;
    inFlight.current = true;

    const was = value;
    setValue(!was);
    setCount((c) => (was ? c - 1 : c + 1));

    const formData = new FormData();
    for (const [key, val] of Object.entries(formEntries)) {
      formData.set(key, val);
    }

    startTransition(async () => {
      const result = await action({ success: false, message: "" }, formData);
      if (!result.success) {
        setValue(was);
        setCount((c) => (was ? c + 1 : c - 1));
      }
      inFlight.current = false;
    });
  };

  return { value, count, handleToggle, isPending: inFlight };
}
