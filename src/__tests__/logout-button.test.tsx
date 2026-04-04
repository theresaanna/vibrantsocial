import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockSignOut = vi.fn();

vi.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

import { LogoutButton } from "@/components/logout-button";

describe("LogoutButton", () => {
  it("renders a logout button", () => {
    render(<LogoutButton />);
    expect(screen.getByTestId("logout-button")).toBeInTheDocument();
    expect(screen.getByLabelText("Log out")).toBeInTheDocument();
  });

  it("calls signOut with redirect on click", () => {
    render(<LogoutButton />);
    fireEvent.click(screen.getByTestId("logout-button"));
    expect(mockSignOut).toHaveBeenCalledWith({ redirectTo: "/" });
  });
});
