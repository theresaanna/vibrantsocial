"use client";

import { useState, useEffect, useCallback } from "react";

interface PushNotificationToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

type PermissionState = "default" | "granted" | "denied" | "unsupported";

export function PushNotificationToggle({ enabled, onToggle }: PushNotificationToggleProps) {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PermissionState);
  }, []);

  // Re-register SW if already enabled on mount
  useEffect(() => {
    if (enabled && permission === "granted") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, [enabled, permission]);

  const handleToggle = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    try {
      if (!enabled) {
        // Enable push
        const perm = await Notification.requestPermission();
        setPermission(perm as PermissionState);
        if (perm !== "granted") {
          setLoading(false);
          return;
        }

        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          setLoading(false);
          return;
        }

        const key = urlBase64ToUint8Array(vapidKey);
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key.buffer as ArrayBuffer,
        });

        const json = subscription.toJSON();
        await fetch("/api/notifications/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: json.keys,
          }),
        });

        onToggle(true);
      } else {
        // Disable push
        const registration = await navigator.serviceWorker.getRegistration("/sw.js");
        if (registration) {
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            await fetch("/api/notifications/push/unsubscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ endpoint: subscription.endpoint }),
            });
            await subscription.unsubscribe();
          }
        }

        onToggle(false);
      }
    } catch {
      // Failed silently
    } finally {
      setLoading(false);
    }
  }, [enabled, loading, onToggle]);

  if (permission === "unsupported") {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Push notifications are not supported in this browser.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={handleToggle}
          disabled={loading || permission === "denied"}
          className="rounded"
        />
        <span className="text-sm text-zinc-700 dark:text-zinc-300">
          {loading ? "Setting up..." : "Enable push notifications"}
        </span>
      </label>
      {permission === "denied" && (
        <p className="ml-6 text-xs text-red-600 dark:text-red-400">
          Notifications are blocked. Enable them in your browser settings for this site.
        </p>
      )}
    </div>
  );
}
