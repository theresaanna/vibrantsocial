"use client";

import { useAppVersion } from "@/hooks/use-app-version";
import { UpdateBanner } from "@/components/update-banner";

export function VersionCheck() {
  const { hasUpdate } = useAppVersion();

  if (!hasUpdate) return null;

  // UpdateBanner handles its own show/hide animation internally
  return <UpdateBanner />;
}
