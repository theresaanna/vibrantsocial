import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeedTabs } from "@/components/feed-tabs";

let mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

const lists = [
  { id: "l1", name: "Tech" },
  { id: "l2", name: "Friends" },
];

describe("FeedTabs", () => {
  it("renders Feed tab and list tabs", () => {
    mockSearchParams = new URLSearchParams();
    render(<FeedTabs lists={lists} />);
    expect(screen.getByText("Feed")).toBeInTheDocument();
    expect(screen.getByText("Tech")).toBeInTheDocument();
    expect(screen.getByText("Friends")).toBeInTheDocument();
  });

  it("highlights Feed tab when no list param", () => {
    mockSearchParams = new URLSearchParams();
    render(<FeedTabs lists={lists} />);
    const feedLink = screen.getByText("Feed");
    expect(feedLink.className).toContain("bg-white");
  });

  it("highlights list tab when list param matches", () => {
    mockSearchParams = new URLSearchParams("list=l1");
    render(<FeedTabs lists={lists} />);
    const techLink = screen.getByText("Tech");
    expect(techLink.className).toContain("bg-white");
    const feedLink = screen.getByText("Feed");
    expect(feedLink.className).not.toContain("bg-white");
  });

  it("renders correct hrefs", () => {
    mockSearchParams = new URLSearchParams();
    render(<FeedTabs lists={lists} />);
    expect(screen.getByText("Feed").closest("a")).toHaveAttribute("href", "/feed");
    expect(screen.getByText("Tech").closest("a")).toHaveAttribute("href", "/feed?list=l1");
    expect(screen.getByText("Friends").closest("a")).toHaveAttribute("href", "/feed?list=l2");
  });

  it("renders + link to manage lists", () => {
    mockSearchParams = new URLSearchParams();
    render(<FeedTabs lists={lists} />);
    const plusLink = screen.getByText("+");
    expect(plusLink.closest("a")).toHaveAttribute("href", "/lists");
  });
});
