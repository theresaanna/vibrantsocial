import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockCreateBillingPortal = vi.fn();
vi.mock("@/app/premium/actions", () => ({
  createBillingPortal: (...args: unknown[]) =>
    mockCreateBillingPortal(...args),
}));

import { ManageButton } from "@/app/premium/manage-button";

describe("ManageButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });
  });

  it("renders manage subscription button", () => {
    render(<ManageButton />);
    expect(screen.getByText("Manage Subscription")).toBeInTheDocument();
  });

  it("shows loading state when clicked", async () => {
    mockCreateBillingPortal.mockReturnValue(new Promise(() => {}));
    render(<ManageButton />);

    fireEvent.click(screen.getByText("Manage Subscription"));
    await waitFor(() => {
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  it("disables button while loading", async () => {
    mockCreateBillingPortal.mockReturnValue(new Promise(() => {}));
    render(<ManageButton />);

    fireEvent.click(screen.getByText("Manage Subscription"));
    await waitFor(() => {
      expect(screen.getByText("Loading...")).toBeDisabled();
    });
  });

  it("calls createBillingPortal on click", async () => {
    mockCreateBillingPortal.mockResolvedValueOnce({
      success: true,
      url: "https://billing.stripe.com/session",
    });
    render(<ManageButton />);

    fireEvent.click(screen.getByText("Manage Subscription"));
    await waitFor(() => {
      expect(mockCreateBillingPortal).toHaveBeenCalledTimes(1);
    });
  });

  it("redirects to billing portal URL on success", async () => {
    mockCreateBillingPortal.mockResolvedValueOnce({
      success: true,
      url: "https://billing.stripe.com/session/abc",
    });
    render(<ManageButton />);

    fireEvent.click(screen.getByText("Manage Subscription"));
    await waitFor(() => {
      expect(window.location.href).toBe("https://billing.stripe.com/session/abc");
    });
  });

  it("shows error message on failure", async () => {
    mockCreateBillingPortal.mockResolvedValueOnce({
      success: false,
      message: "No active subscription found",
    });
    render(<ManageButton />);

    fireEvent.click(screen.getByText("Manage Subscription"));
    await waitFor(() => {
      expect(screen.getByText("No active subscription found")).toBeInTheDocument();
    });
  });

  it("shows generic error on thrown exception", async () => {
    mockCreateBillingPortal.mockRejectedValueOnce(new Error("Portal error"));
    render(<ManageButton />);

    fireEvent.click(screen.getByText("Manage Subscription"));
    await waitFor(() => {
      expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
    });
  });

  it("shows error when no URL is returned", async () => {
    mockCreateBillingPortal.mockResolvedValueOnce({
      success: true,
      message: "Created",
      url: undefined,
    });
    render(<ManageButton />);

    fireEvent.click(screen.getByText("Manage Subscription"));
    await waitFor(() => {
      expect(screen.getByText("No portal URL returned")).toBeInTheDocument();
    });
  });
});
