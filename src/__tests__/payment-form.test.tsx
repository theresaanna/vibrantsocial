import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { PaymentForm } from "@/app/payment/payment-form";

describe("PaymentForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the pay button with correct price", () => {
    render(<PaymentForm />);

    expect(
      screen.getByRole("button", { name: /pay \$2\.99/i })
    ).toBeInTheDocument();
  });

  it("renders the price breakdown", () => {
    render(<PaymentForm />);

    expect(screen.getByText("$2.99")).toBeInTheDocument();
    expect(screen.getByText(/age verification fee/i)).toBeInTheDocument();
    expect(screen.getByText(/one-time payment/i)).toBeInTheDocument();
  });

  it("shows Stripe redirect notice", () => {
    render(<PaymentForm />);

    expect(
      screen.getByText(/redirected to stripe/i)
    ).toBeInTheDocument();
  });

  it("shows canceled message when canceled prop is true", () => {
    render(<PaymentForm canceled />);

    expect(
      screen.getByText(/payment was canceled/i)
    ).toBeInTheDocument();
  });

  it("does not show error when canceled is false", () => {
    render(<PaymentForm canceled={false} />);

    expect(screen.queryByText(/payment was canceled/i)).not.toBeInTheDocument();
  });

  it("shows loading state when checkout is in progress", async () => {
    // Never resolve the fetch to keep loading state
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    render(<PaymentForm />);

    fireEvent.click(screen.getByRole("button", { name: /pay \$2\.99/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /redirecting to checkout/i })
      ).toBeInTheDocument();
    });
  });

  it("shows error when fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    render(<PaymentForm />);

    fireEvent.click(screen.getByRole("button", { name: /pay \$2\.99/i }));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it("shows error when API returns error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Already paid" }),
    });

    render(<PaymentForm />);

    fireEvent.click(screen.getByRole("button", { name: /pay \$2\.99/i }));

    await waitFor(() => {
      expect(screen.getByText(/already paid/i)).toBeInTheDocument();
    });
  });

  it("redirects to Stripe URL on successful checkout creation", async () => {
    const mockUrl = "https://checkout.stripe.com/test-session";

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: mockUrl }),
    });

    // Mock window.location.href assignment
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, href: "" },
    });

    render(<PaymentForm />);

    fireEvent.click(screen.getByRole("button", { name: /pay \$2\.99/i }));

    await waitFor(() => {
      expect(window.location.href).toBe(mockUrl);
    });

    // Restore
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  it("disables button during loading", async () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    render(<PaymentForm />);

    const button = screen.getByRole("button", { name: /pay \$2\.99/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /redirecting to checkout/i })
      ).toBeDisabled();
    });
  });
});
