import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PushNotificationToggle } from "@/components/push-notification-toggle";

describe("PushNotificationToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: browser supports notifications and permission is default
    Object.defineProperty(globalThis, "Notification", {
      value: { permission: "default", requestPermission: vi.fn() },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue({ pushManager: {} }),
        ready: Promise.resolve({ pushManager: {} }),
        getRegistration: vi.fn().mockResolvedValue(null),
      },
      writable: true,
      configurable: true,
    });
  });

  it("renders the toggle checkbox", () => {
    render(<PushNotificationToggle enabled={false} onToggle={vi.fn()} />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.getByText("Enable push notifications")).toBeInTheDocument();
  });

  it("shows checked state when enabled", () => {
    render(<PushNotificationToggle enabled={true} onToggle={vi.fn()} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("shows unchecked state when disabled", () => {
    render(<PushNotificationToggle enabled={false} onToggle={vi.fn()} />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("shows unsupported message when Notification API missing", () => {
    // Delete the property so "Notification" in window is false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).Notification;
    render(<PushNotificationToggle enabled={false} onToggle={vi.fn()} />);
    expect(screen.getByText(/not supported/i)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows denied message when permission is denied", () => {
    Object.defineProperty(globalThis, "Notification", {
      value: { permission: "denied", requestPermission: vi.fn() },
      writable: true,
      configurable: true,
    });
    render(<PushNotificationToggle enabled={false} onToggle={vi.fn()} />);
    expect(screen.getByText(/blocked/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("disables checkbox when permission is denied", () => {
    Object.defineProperty(globalThis, "Notification", {
      value: { permission: "denied", requestPermission: vi.fn() },
      writable: true,
      configurable: true,
    });
    render(<PushNotificationToggle enabled={false} onToggle={vi.fn()} />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("calls onToggle(false) when disabling", async () => {
    const onToggle = vi.fn();
    const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);
    const mockGetSubscription = vi.fn().mockResolvedValue({
      endpoint: "https://push.example.com/sub",
      unsubscribe: mockUnsubscribe,
    });

    Object.defineProperty(globalThis, "Notification", {
      value: { permission: "granted", requestPermission: vi.fn() },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue({ pushManager: { getSubscription: mockGetSubscription } }),
        ready: Promise.resolve({ pushManager: { getSubscription: mockGetSubscription } }),
        getRegistration: vi.fn().mockResolvedValue({
          pushManager: { getSubscription: mockGetSubscription },
        }),
      },
      writable: true,
      configurable: true,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });

    const user = userEvent.setup();
    render(<PushNotificationToggle enabled={true} onToggle={onToggle} />);
    await user.click(screen.getByRole("checkbox"));

    await vi.waitFor(() => expect(onToggle).toHaveBeenCalledWith(false));
  });
});
