import { useEffect } from "react";

/**
 * Handles Escape key to close a modal and optionally locks body scroll.
 *
 * @param isOpen - Whether the modal is currently open
 * @param onClose - Callback to close the modal
 * @param options.lockScroll - Whether to set body overflow to hidden (default: true)
 * @param options.enabled - Extra condition that must be true for Escape to fire (e.g. `!uploading`)
 */
export function useModal(
  isOpen: boolean,
  onClose: () => void,
  options?: { lockScroll?: boolean; enabled?: boolean }
) {
  const lockScroll = options?.lockScroll ?? true;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && enabled) onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    if (lockScroll) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (lockScroll) {
        document.body.style.overflow = "";
      }
    };
  }, [isOpen, onClose, lockScroll, enabled]);
}
