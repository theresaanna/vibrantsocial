import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PromoteToFeedButton } from "@/components/promote-to-feed-button";

vi.mock("@/app/marketplace/actions", () => ({
  promoteToFeed: vi.fn(),
}));

import { promoteToFeed } from "@/app/marketplace/actions";

describe("PromoteToFeedButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Promote to Feed' when not promoted", () => {
    render(<PromoteToFeedButton postId="post-1" isPromoted={false} />);
    expect(screen.getByText("Promote to Feed")).toBeInTheDocument();
  });

  it("renders 'In Feed' when promoted", () => {
    render(<PromoteToFeedButton postId="post-1" isPromoted={true} />);
    expect(screen.getByText("In Feed")).toBeInTheDocument();
  });

  it("has data-testid", () => {
    render(<PromoteToFeedButton postId="post-1" isPromoted={false} />);
    expect(screen.getByTestId("promote-to-feed-button")).toBeInTheDocument();
  });

  it("calls promoteToFeed when clicked", async () => {
    const mockPromote = promoteToFeed as ReturnType<typeof vi.fn>;
    mockPromote.mockResolvedValue({ success: true, message: "Promoted" });

    render(<PromoteToFeedButton postId="post-1" isPromoted={false} />);
    await userEvent.click(screen.getByTestId("promote-to-feed-button"));

    expect(mockPromote).toHaveBeenCalledWith("post-1");
  });

  it("applies pink styling when promoted", () => {
    render(<PromoteToFeedButton postId="post-1" isPromoted={true} />);
    const button = screen.getByTestId("promote-to-feed-button");
    expect(button.className).toContain("border-pink-300");
  });

  it("applies zinc styling when not promoted", () => {
    render(<PromoteToFeedButton postId="post-1" isPromoted={false} />);
    const button = screen.getByTestId("promote-to-feed-button");
    expect(button.className).toContain("border-zinc-200");
  });
});
