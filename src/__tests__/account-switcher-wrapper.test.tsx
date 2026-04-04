import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-auth/react", () => ({
  useSession: vi.fn().mockReturnValue({
    data: {
      user: {
        id: "user1",
        username: "user_one",
        displayName: "User One",
        avatar: null,
        bio: null,
        tier: "free",
        isEmailVerified: true,
        authProvider: "credentials",
        linkedAccounts: [],
        profileFrameId: null,
        usernameFont: null,
      },
      expires: "2026-12-31",
    },
    status: "authenticated",
    update: vi.fn(),
  }),
  signOut: vi.fn(),
}));

vi.mock("@/app/profile/account-linking-actions", () => ({
  switchAccount: vi.fn(),
}));

vi.mock("@/app/providers", () => ({
  useAblyReady: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/ably", () => ({
  getAblyRealtimeClient: vi.fn(),
}));

vi.mock("@/app/notifications/actions", () => ({
  getLinkedAccountNotificationCounts: vi.fn().mockResolvedValue({}),
}));

import { AccountSwitcherWrapper } from "@/components/account-switcher-wrapper";

const linkedAccounts = [
  { id: "user2", username: "user_two", displayName: "User Two", avatar: null, profileFrameId: null, usernameFont: null },
];

describe("AccountSwitcherWrapper", () => {
  it("renders logout button when no linked accounts", () => {
    render(<AccountSwitcherWrapper initialLinkedAccounts={[]} />);
    expect(screen.getByTestId("logout-button")).toBeInTheDocument();
    expect(screen.queryByTestId("account-switcher-button")).not.toBeInTheDocument();
  });

  it("renders account switcher when linked accounts exist", () => {
    render(<AccountSwitcherWrapper initialLinkedAccounts={linkedAccounts} />);
    expect(screen.getByTestId("account-switcher-button")).toBeInTheDocument();
    expect(screen.queryByTestId("logout-button")).not.toBeInTheDocument();
  });

  it("renders logout button by default when no props provided", () => {
    render(<AccountSwitcherWrapper />);
    expect(screen.getByTestId("logout-button")).toBeInTheDocument();
  });
});
