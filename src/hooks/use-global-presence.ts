"use client";

import { usePresence, usePresenceListener } from "ably/react";
import { useMemo } from "react";

const CHANNEL_NAME = "presence:global";

export function useGlobalPresence() {
  usePresence(CHANNEL_NAME, { status: "online" });
  const { presenceData } = usePresenceListener(CHANNEL_NAME);

  const onlineUserIds = useMemo(
    () => new Set(presenceData.map((member) => member.clientId)),
    [presenceData]
  );

  return { onlineUserIds };
}
