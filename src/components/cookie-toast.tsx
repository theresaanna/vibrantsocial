"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "vibrantsocial-cookie-notice-dismissed";

export function CookieToast() {
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") return;
    } catch {
      return;
    }

    // Small delay so it doesn't flash during page hydration
    const timer = setTimeout(() => {
      toast(
        <div>
          <p className="text-sm">
            We use cookies for authentication purposes only. We do not track you
            or sell your data.{" "}
            <a
              href="/cookies"
              className="font-medium underline"
            >
              Cookie Policy
            </a>
          </p>
        </div>,
        {
          duration: Infinity,
          closeButton: true,
          onDismiss: () => {
            try {
              localStorage.setItem(STORAGE_KEY, "true");
            } catch {
              // Private browsing or quota exceeded
            }
          },
          onAutoClose: () => {
            try {
              localStorage.setItem(STORAGE_KEY, "true");
            } catch {
              // Private browsing or quota exceeded
            }
          },
        }
      );
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
