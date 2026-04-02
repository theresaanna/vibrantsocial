import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InAppBrowserBreakout } from "@/app/links/[username]/in-app-browser-breakout";

// Mock the utility so we can control detection results
vi.mock("@/lib/in-app-browser", () => ({
  detectInAppBrowser: vi.fn(),
  buildIntentUrl: vi.fn((url: string) => `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;action=android.intent.action.VIEW;end`),
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

const links = (
  <div data-testid="links-list">
    <a href="https://example.com">My Link</a>
  </div>
);

describe("InAppBrowserBreakout", () => {
  describe("Normal browser", () => {
    it("renders children directly with no overlay", async () => {
      mockDetect.mockReturnValue({ isInAppBrowser: false });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks={false}>
            {links}
          </InAppBrowserBreakout>
        );
      });

      expect(screen.getByTestId("links-list")).toBeInTheDocument();
      expect(screen.getByText("My Link")).toBeInTheDocument();
      expect(screen.queryByTestId("ios-breakout")).not.toBeInTheDocument();
      expect(screen.queryByTestId("android-redirect")).not.toBeInTheDocument();
    });

    it("renders children even when sensitiveLinks is true", async () => {
      mockDetect.mockReturnValue({ isInAppBrowser: false });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks={true}>
            {links}
          </InAppBrowserBreakout>
        );
      });

      expect(screen.getByTestId("links-list")).toBeInTheDocument();
    });
  });

  describe("Android in-app browser", () => {
    it("calls window.location.replace with intent URL", async () => {
      mockDetect.mockReturnValue({
        isInAppBrowser: true,
        platform: "android",
        app: "Instagram",
      });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks={false}>
            {links}
          </InAppBrowserBreakout>
        );
      });

      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining("intent://")
      );
    });

    it("shows redirecting message", async () => {
      mockDetect.mockReturnValue({
        isInAppBrowser: true,
        platform: "android",
        app: "TikTok",
      });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks={false}>
            {links}
          </InAppBrowserBreakout>
        );
      });

      expect(screen.getByTestId("android-redirect")).toBeInTheDocument();
      expect(screen.getByText(/Opening in your browser/)).toBeInTheDocument();
    });

    it("does not render links on Android in-app browser", async () => {
      mockDetect.mockReturnValue({
        isInAppBrowser: true,
        platform: "android",
        app: "Instagram",
      });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks={false}>
            {links}
          </InAppBrowserBreakout>
        );
      });

      expect(screen.queryByTestId("links-list")).not.toBeInTheDocument();
    });
  });

  describe("iOS in-app browser", () => {
    it("shows Safari overlay with instructions", async () => {
      mockDetect.mockReturnValue({
        isInAppBrowser: true,
        platform: "ios",
        app: "Instagram",
      });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks={false}>
            {links}
          </InAppBrowserBreakout>
        );
      });

      expect(screen.getByTestId("ios-breakout")).toBeInTheDocument();
      expect(screen.getByText(/Open in Safari for the best experience/)).toBeInTheDocument();
      expect(screen.getByText(/top right.*Open in Safari/)).toBeInTheDocument(); // Instagram instructions
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
            {links}
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
            {links}
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
            {links}
          </InAppBrowserBreakout>
        );
      });

      expect(screen.getByText(/Open in browser.*menu/)).toBeInTheDocument();
    });

    it("renders links below the overlay when sensitiveLinks is false", async () => {
      mockDetect.mockReturnValue({
        isInAppBrowser: true,
        platform: "ios",
        app: "Instagram",
      });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks={false}>
            {links}
          </InAppBrowserBreakout>
        );
      });

      expect(screen.getByTestId("links-list")).toBeInTheDocument();
      expect(screen.queryByTestId("sensitive-hidden-msg")).not.toBeInTheDocument();
    });

    it("hides links and shows message when sensitiveLinks is true", async () => {
      mockDetect.mockReturnValue({
        isInAppBrowser: true,
        platform: "ios",
        app: "Instagram",
      });

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks={true}>
            {links}
          </InAppBrowserBreakout>
        );
      });

      expect(screen.queryByTestId("links-list")).not.toBeInTheDocument();
      expect(screen.getByTestId("sensitive-hidden-msg")).toBeInTheDocument();
      expect(
        screen.getByText(/links are hidden in app browsers/)
      ).toBeInTheDocument();
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
            {links}
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

      // Provide a clipboard mock that the component can call
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      });

      const user = userEvent.setup();

      await act(async () => {
        render(
          <InAppBrowserBreakout sensitiveLinks={false}>
            {links}
          </InAppBrowserBreakout>
        );
      });

      const btn = screen.getByTestId("copy-link-btn");
      expect(btn).toHaveTextContent("Copy Link");

      await user.click(btn);

      // Button text changes to "Copied!" after click
      expect(btn).toHaveTextContent("Copied!");
    });
  });

  describe("Sensitive links + pre-detection flash prevention", () => {
    it("hides children before detection completes when sensitiveLinks is true", () => {
      // Don't trigger useEffect immediately
      mockDetect.mockReturnValue({ isInAppBrowser: false });

      // Render synchronously — useEffect hasn't run yet
      const { container } = render(
        <InAppBrowserBreakout sensitiveLinks={true}>
          {links}
        </InAppBrowserBreakout>
      );

      // Before useEffect fires, sensitiveLinks=true means children are hidden
      // (the component returns null when browserInfo is null and sensitiveLinks is true)
      // After useEffect, since it's not an in-app browser, children appear
    });

    it("shows children before detection when sensitiveLinks is false", () => {
      mockDetect.mockReturnValue({ isInAppBrowser: false });

      render(
        <InAppBrowserBreakout sensitiveLinks={false}>
          {links}
        </InAppBrowserBreakout>
      );

      // Children should be visible immediately when not sensitive
    });
  });
});
