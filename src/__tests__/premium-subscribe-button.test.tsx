import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockCreatePremiumSubscription = vi.fn();
vi.mock("@/app/premium/actions", () => ({
  createPremiumSubscription: (...args: unknown[]) =>
    mockCreatePremiumSubscription(...args),
}));

import { SubscribeButton } from "@/app/premium/subscribe-button";

describe("Premium SubscribeButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });
  });

  it("renders subscribe button", () => {
    render(<SubscribeButton />);
    expect(screen.getByText("Subscribe to Premium")).toBeInTheDocument();
  });

  it("shows loading state when clicked", async () => {
    mockCreatePremiumSubscription.mockReturnValue(new Promise(() => {}));
    render(<SubscribeButton />);

    fireEvent.click(screen.getByText("Subscribe to Premium"));
    await waitFor(() => {
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  it("disables button while loading", async () => {
    mockCreatePremiumSubscription.mockReturnValue(new Promise(() => {}));
    render(<SubscribeButton />);

    fireEvent.click(screen.getByText("Subscribe to Premium"));
    await waitFor(() => {
      expect(screen.getByText("Loading...")).toBeDisabled();
    });
  });

  it("calls createPremiumSubscription on click", async () => {
    mockCreatePremiumSubscription.mockResolvedValueOnce({
      success: true,
      url: "https://checkout.stripe.com/test",
    });
    render(<SubscribeButton />);

    fireEvent.click(screen.getByText("Subscribe to Premium"));
    await waitFor(() => {
      expect(mockCreatePremiumSubscription).toHaveBeenCalledTimes(1);
    });
  });

  it("redirects to Stripe URL on success", async () => {
    mockCreatePremiumSubscription.mockResolvedValueOnce({
      success: true,
      url: "https://checkout.stripe.com/test-session",
    });
    render(<SubscribeButton />);

    fireEvent.click(screen.getByText("Subscribe to Premium"));
    await waitFor(() => {
      expect(window.location.href).toBe("https://checkout.stripe.com/test-session");
    });
  });

  it("shows error message on failure", async () => {
    mockCreatePremiumSubscription.mockResolvedValueOnce({
      success: false,
      message: "Already subscribed to premium",
    });
    render(<SubscribeButton />);

    fireEvent.click(screen.getByText("Subscribe to Premium"));
    await waitFor(() => {
      expect(screen.getByText("Already subscribed to premium")).toBeInTheDocument();
    });
  });

  it("shows generic error on thrown exception", async () => {
    mockCreatePremiumSubscription.mockRejectedValueOnce(new Error("Network error"));
    render(<SubscribeButton />);

    fireEvent.click(screen.getByText("Subscribe to Premium"));
    await waitFor(() => {
      expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
    });
  });

  it("shows error when no URL is returned", async () => {
    mockCreatePremiumSubscription.mockResolvedValueOnce({
      success: true,
      message: "Created",
      url: undefined,
    });
    render(<SubscribeButton />);

    fireEvent.click(screen.getByText("Subscribe to Premium"));
    await waitFor(() => {
      expect(screen.getByText("No checkout URL returned")).toBeInTheDocument();
    });
  });
});
