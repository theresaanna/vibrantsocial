"use client";

import { useState } from "react";
import { AccountSwitcher } from "./account-switcher";
import { LogoutButton } from "./logout-button";
import { LinkAccountModal } from "./link-account-modal";
import type { LinkedAccount } from "@/types/next-auth";

export function AccountSwitcherWrapper({
  initialLinkedAccounts = [],
  initialNotificationCounts = {},
}: {
  initialLinkedAccounts?: LinkedAccount[];
  initialNotificationCounts?: Record<string, number>;
}) {
  const [showLinkModal, setShowLinkModal] = useState(false);

  return (
    <>
      {initialLinkedAccounts.length > 0 ? (
        <AccountSwitcher
          onAddAccount={() => setShowLinkModal(true)}
          initialLinkedAccounts={initialLinkedAccounts}
          initialNotificationCounts={initialNotificationCounts}
        />
      ) : (
        <LogoutButton />
      )}
      {showLinkModal && (
        <LinkAccountModal
          isOpen={showLinkModal}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </>
  );
}
