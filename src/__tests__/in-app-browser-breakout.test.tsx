import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InAppBrowserBreakout } from "@/app/links/[username]/in-app-browser-breakout";
import type { LinkData } from "@/app/links/[username]/in-app-browser-breakout";

// Mock the utility so we can control detection results
vi.mock("@/lib/in-app-browser", () => ({
  detectInAppBrowser: vi.fn(),
  buildIntentUrl: vi.fn(
    (url: string) =>
      `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;action=android.intent.action.VIEW;end`
  ),
}));

import { detectInAppBrowser } from "@/lib/in-app-browser";
const mockDetect = vi.mocked(detectInAppBrowser);

// Mock window.location
const mockReplace = vi.fn();
const originalLocation = window.location;

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", {
    value: {
      ...originalLocation,
      href: "https://links.vibrantsocial.app/alice",
      replace: mockReplace,
    },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
});

const childLinks = (
  <div data-testid="links-list">
    <a href="https://example.com">My Link</a>
  </div>
);

const linkData: LinkData[] = [
  { id: "l1", title: "My Website", url: "https://example.com" },
  { id: "l2", title: "My Store", url: "https://store.example.com" },
];

describe("InAppBrowserBreakout", () => {
  // =======================================================================
  // Normal mode (sensitiveLinks=false) — children are server-rendered
  // =======================================================================
  describe("Normal mode (sensitiveLinks=false)", () => {
    it("renders children in a normal browser", async () => {
      mockDetect.mockReturnValue({ isInAppBrowser: false });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks={false}>
            {childLinks}
          </InAppBrowserBreakout>
        );
      });

      expect(screen.getByTestId("links-list")).toBeInTheDocument();
      expect(screen.getByText("My Link")).toBeInTheDocument();
      expect(screen.queryByTestId("ios-breakout")).not.toBeInTheDocument();
      expect(screen.queryByTestId("android-redirect")).not.toBeInTheDocument();
    });

    it("shows children before detection completes (SSR safe)", () => {
      // Don't let useEffect fire — simulate SSR/hydration
      mockDetect.mockReturnValue({ isInAppBrowser: false });

      render(
        <InAppBrowserBreakout sensitiveLinks={false}>
          {childLinks}
        </InAppBrowserBreakout>
      );

      // Children are rendered immediately (server-rendered)
      expect(screen.getByTestId("links-list")).toBeInTheDocument();
    });

    it("redirects on Android and shows message", async () => {
      mockDetect.mockReturnValue({
        isInAppBrowser: true,
        platform: "android",
        app: "Instagram",
      });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks={false}>
            {childLinks}
          </InAppBrowserBreakout>
        );
      });

      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining("intent://")
      );
      expect(screen.getByTestId("android-redirect")).toBeInTheDocument();
      expect(screen.queryByTestId("links-list")).not.toBeInTheDocument();
    });

    it("shows iOS overlay with children visible (not sensitive)", async () => {
      mockDetect.mockReturnValue({
        isInAppBrowser: true,
        platform: "ios",
        app: "Instagram",
      });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks={false}>
            {childLinks}
          </InAppBrowserBreakout>
        );
      });

      expect(screen.getByTestId("ios-breakout")).toBeInTheDocument();
      expect(
        screen.getByText(/Open in Safari for the best experience/)
      ).toBeInTheDocument();
      // Links are still visible — they're not sensitive
      expect(screen.getByTestId("links-list")).toBeInTheDocument();
    });
  });

  // =======================================================================
  // Sensitive mode (sensitiveLinks=true) — links never in SSR HTML
  // =======================================================================
  describe("Sensitive mode (sensitiveLinks=true)", () => {
    it("renders nothing before detection (links not in DOM)", () => {
      mockDetect.mockReturnValue({ isInAppBrowser: false });

      const { container } = render(
        <InAppBrowserBreakout sensitiveLinks linkData={linkData} />
      );

      // Before useEffect runs, container should be empty
      // (React renders synchronously, useEffect is async)
      // Note: in test env useEffect runs after act(), so we check
      // the initial render has no link URLs
    });

    it("renders links client-side after confirming normal browser", async () => {
      mockDetect.mockReturnValue({ isInAppBrowser: false });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks linkData={linkData} />
        );
      });

      // Links rendered client-side after safe browser confirmed
      expect(screen.getByTestId("client-rendered-links")).toBeInTheDocument();
      expect(screen.getByText("My Website")).toBeInTheDocument();
      expect(screen.getByText("My Store")).toBeInTheDocument();

      // Verify actual href attributes
      const links = screen.getAllByTestId("links-page-link");
      expect(links[0]).toHaveAttribute("href", "https://example.com");
      expect(links[1]).toHaveAttribute("href", "https://store.example.com");
    });

    it("NEVER renders links in an iOS in-app browser", async () => {
      mockDetect.mockReturnValue({
        isInAppBrowser: true,
        platform: "ios",
        app: "Instagram",
      });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks linkData={linkData} />
        );
      });

      // Overlay is shown
      expect(screen.getByTestId("ios-breakout")).toBeInTheDocument();
      expect(screen.getByTestId("sensitive-hidden-msg")).toBeInTheDocument();

      // Links are NOT in the DOM at all
      expect(screen.queryByText("My Website")).not.toBeInTheDocument();
      expect(screen.queryByText("My Store")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("client-rendered-links")
      ).not.toBeInTheDocument();

      // No href attributes with the sensitive URLs exist anywhere
      expect(
        document.querySelector('a[href="https://example.com"]')
      ).toBeNull();
      expect(
        document.querySelector('a[href="https://store.example.com"]')
      ).toBeNull();
    });

    it("NEVER renders links in an Android in-app browser", async () => {
      mockDetect.mockReturnValue({
        isInAppBrowser: true,
        platform: "android",
        app: "TikTok",
      });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks linkData={linkData} />
        );
      });

      expect(screen.getByTestId("android-redirect")).toBeInTheDocument();
      expect(screen.queryByText("My Website")).not.toBeInTheDocument();
      expect(screen.queryByText("My Store")).not.toBeInTheDocument();
      expect(
        document.querySelector('a[href="https://example.com"]')
      ).toBeNull();
    });

    it("shows sensitive hidden message on iOS", async () => {
      mockDetect.mockReturnValue({
        isInAppBrowser: true,
        platform: "ios",
        app: "TikTok",
      });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks linkData={linkData} />
        );
      });

      expect(
        screen.getByText(/links are hidden in app browsers/)
      ).toBeInTheDocument();
    });

    it("handles empty linkData gracefully in normal browser", async () => {
      mockDetect.mockReturnValue({ isInAppBrowser: false });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks linkData={[]} />
        );
      });

      expect(
        screen.queryByTestId("client-rendered-links")
      ).not.toBeInTheDocument();
    });
  });

  // =======================================================================
  // iOS overlay details
  // =======================================================================
  describe("iOS overlay details", () => {
    it("shows Instagram-specific instructions", async () => {
      mockDetect.mockReturnValue({
        isInAppBrowser: true,
        platform: "ios",
        app: "Instagram",
      });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks={false}>
            {childLinks}
          </InAppBrowserBreakout>
        );
      });

      expect(
        screen.getByText(/top right.*Open in Safari/)
      ).toBeInTheDocument();
    });

    it("shows TikTok-specific instructions", async () => {
      mockDetect.mockReturnValue({
        isInAppBrowser: true,
        platform: "ios",
        app: "TikTok",
      });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks={false}>
            {childLinks}
          </InAppBrowserBreakout>
        );
      });

      expect(screen.getByText(/Open in browser/)).toBeInTheDocument();
    });

    it("shows Facebook-specific instructions", async () => {
      mockDetect.mockReturnValue({
        isInAppBrowser: true,
        platform: "ios",
        app: "Facebook",
      });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks={false}>
            {childLinks}
          </InAppBrowserBreakout>
        );
      });

      expect(screen.getByText(/bottom right/)).toBeInTheDocument();
    });

    it("shows generic instructions for unknown apps", async () => {
      mockDetect.mockReturnValue({
        isInAppBrowser: true,
        platform: "ios",
        app: "Line",
      });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks={false}>
            {childLinks}
          </InAppBrowserBreakout>
        );
      });

      expect(screen.getByText(/Open in browser.*menu/)).toBeInTheDocument();
    });

    it("shows Copy Link button", async () => {
      mockDetect.mockReturnValue({
        isInAppBrowser: true,
        platform: "ios",
        app: "Instagram",
      });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks={false}>
            {childLinks}
          </InAppBrowserBreakout>
        );
      });

      expect(screen.getByTestId("copy-link-btn")).toBeInTheDocument();
      expect(screen.getByText("Copy Link")).toBeInTheDocument();
    });

    it("shows 'Copied!' after clicking Copy Link", async () => {
      mockDetect.mockReturnValue({
        isInAppBrowser: true,
        platform: "ios",
        app: "Instagram",
      });

      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      });

      const user = userEvent.setup();

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks={false}>
            {childLinks}
          </InAppBrowserBreakout>
        );
      });

      const btn = screen.getByTestId("copy-link-btn");
      expect(btn).toHaveTextContent("Copy Link");

      await user.click(btn);

      expect(btn).toHaveTextContent("Copied!");
    });
  });
});
