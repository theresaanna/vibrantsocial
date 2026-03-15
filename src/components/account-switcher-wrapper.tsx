"use client";

import { useState } from "react";
import { AccountSwitcher } from "./account-switcher";
import { LinkAccountModal } from "./link-account-modal";
import type { LinkedAccount } from "@/types/next-auth";

export function AccountSwitcherWrapper({
  initialLinkedAccounts = [],
}: {
  initialLinkedAccounts?: LinkedAccount[];
}) {
  const [showLinkModal, setShowLinkModal] = useState(false);

  return (
    <>
      <AccountSwitcher
        onAddAccount={() => setShowLinkModal(true)}
        initialLinkedAccounts={initialLinkedAccounts}
      />
      {showLinkModal && (
        <LinkAccountModal
          isOpen={showLinkModal}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </>
  );
}
