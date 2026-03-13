import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToastProvider } from "@/components/toast-provider";

vi.mock("next-auth/react", () => ({
  useSession: vi.fn().mockReturnValue({
    data: { user: { id: "user1" } },
  }),
}));

vi.mock("next-themes", () => ({
  useTheme: vi.fn().mockReturnValue({ resolvedTheme: "light" }),
}));

vi.mock("@/app/providers", () => ({
  useAblyReady: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/ably", () => ({
  getAblyRealtimeClient: vi.fn(),
}));

let capturedToasterProps: Record<string, unknown> = {};

vi.mock("sonner", () => ({
  Toaster: (props: Record<string, unknown>) => {
    capturedToasterProps = props;
    return <div data-testid="toaster" data-theme={props.theme as string} />;
  },
  toast: vi.fn(),
}));

describe("ToastProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedToasterProps = {};
  });

  it("renders the Toaster component", () => {
    render(<ToastProvider />);
    expect(screen.getByTestId("toaster")).toBeInTheDocument();
  });

  it("passes light theme to Toaster when resolvedTheme is light", () => {
    render(<ToastProvider />);
    expect(capturedToasterProps.theme).toBe("light");
  });

  it("passes dark theme to Toaster when resolvedTheme is dark", async () => {
    const { useTheme } = await import("next-themes");
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: "dark",
      theme: "dark",
      themes: [],
      setTheme: vi.fn(),
      systemTheme: "dark",
      forcedTheme: undefined,
    });

    render(<ToastProvider />);
    expect(capturedToasterProps.theme).toBe("dark");
  });

  it("sets position to bottom-right", () => {
    render(<ToastProvider />);
    expect(capturedToasterProps.position).toBe("bottom-right");
  });

  it("enables richColors", () => {
    render(<ToastProvider />);
    expect(capturedToasterProps.richColors).toBe(true);
  });
});
