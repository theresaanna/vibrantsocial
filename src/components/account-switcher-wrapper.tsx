"use client";

import { useState } from "react";
import { AccountSwitcher } from "./account-switcher";
import { LinkAccountModal } from "./link-account-modal";

export function AccountSwitcherWrapper() {
  const [showLinkModal, setShowLinkModal] = useState(false);

  return (
    <>
      <AccountSwitcher onAddAccount={() => setShowLinkModal(true)} />
      {showLinkModal && (
        <LinkAccountModal
          isOpen={showLinkModal}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </>
  );
}
