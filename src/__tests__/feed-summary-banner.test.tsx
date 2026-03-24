import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedSummaryBanner } from "@/components/feed-summary-banner";

const mockFetchFeedSummary = vi.fn();
const mockGenerateFeedSummaryOnDemand = vi.fn();

vi.mock("@/app/feed/summary-actions", () => ({
  fetchFeedSummary: (...args: unknown[]) => mockFetchFeedSummary(...args),
  generateFeedSummaryOnDemand: (...args: unknown[]) =>
    mockGenerateFeedSummaryOnDemand(...args),
}));

describe("FeedSummaryBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows summarize button when posts are available", async () => {
    mockFetchFeedSummary.mockResolvedValue({
      summary: null,
      missedCount: 3,
      tooMany: false,
    });

    render(
      <FeedSummaryBanner lastSeenFeedAt="2026-03-22T00:00:00Z" />
    );

    // Header shows immediately
    expect(screen.getByText(/While you were away/)).toBeInTheDocument();

    // Button appears after loading
    await waitFor(() => {
      expect(screen.getByText(/3 new posts/)).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Summarize what I missed" })
    ).toBeInTheDocument();
  });

  it("renders nothing when no missed posts", async () => {
    mockFetchFeedSummary.mockResolvedValue({
      summary: null,
      missedCount: 0,
      tooMany: false,
    });

    const { container } = render(
      <FeedSummaryBanner lastSeenFeedAt="2026-03-23T23:00:00Z" />
    );

    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  it("shows 'Summarize' button when too many posts", async () => {
    mockFetchFeedSummary.mockResolvedValue({
      summary: null,
      missedCount: 51,
      tooMany: true,
    });

    render(
      <FeedSummaryBanner lastSeenFeedAt="2026-03-22T00:00:00Z" />
    );

    await waitFor(() => {
      expect(screen.getByText(/51\+ new posts/)).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Summarize what I missed" })
    ).toBeInTheDocument();
  });

  it("generates summary on demand when button clicked", async () => {
    mockFetchFeedSummary.mockResolvedValue({
      summary: null,
      missedCount: 5,
      tooMany: false,
    });
    mockGenerateFeedSummaryOnDemand.mockResolvedValue(
      "Lots of activity today!"
    );

    render(
      <FeedSummaryBanner lastSeenFeedAt="2026-03-22T00:00:00Z" />
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Summarize what I missed" })
      ).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Summarize what I missed" })
    );

    await waitFor(() => {
      expect(
        screen.getByText("Lots of activity today!")
      ).toBeInTheDocument();
    });

    expect(mockGenerateFeedSummaryOnDemand).toHaveBeenCalledWith(
      "2026-03-22T00:00:00Z"
    );
  });

  it("hides when dismiss button clicked", async () => {
    mockFetchFeedSummary.mockResolvedValue({
      summary: null,
      missedCount: 2,
      tooMany: false,
    });

    render(
      <FeedSummaryBanner lastSeenFeedAt="2026-03-22T00:00:00Z" />
    );

    await waitFor(() => {
      expect(screen.getByText(/2 new posts/)).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Dismiss" })
    );

    expect(screen.queryByText(/2 new posts/)).not.toBeInTheDocument();
  });

  it("calls fetchFeedSummary with the lastSeenFeedAt value", async () => {
    mockFetchFeedSummary.mockResolvedValue({
      summary: null,
      missedCount: 0,
      tooMany: false,
    });

    render(
      <FeedSummaryBanner lastSeenFeedAt="2026-03-20T10:00:00Z" />
    );

    await waitFor(() => {
      expect(mockFetchFeedSummary).toHaveBeenCalledWith(
        "2026-03-20T10:00:00Z"
      );
    });
  });
});
