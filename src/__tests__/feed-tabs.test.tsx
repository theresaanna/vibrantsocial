import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeedTabs } from "@/components/feed-tabs";

const lists = [
  { id: "l1", name: "Tech" },
  { id: "l2", name: "Friends" },
];

describe("FeedTabs", () => {
  it("renders Feed tab and list tabs", () => {
    render(<FeedTabs lists={lists} />);
    expect(screen.getByText("Feed")).toBeInTheDocument();
    expect(screen.getByText("Tech")).toBeInTheDocument();
    expect(screen.getByText("Friends")).toBeInTheDocument();
  });

  it("highlights Feed tab when no activeListId", () => {
    render(<FeedTabs lists={lists} />);
    const feedLink = screen.getByText("Feed");
    expect(feedLink.className).toContain("bg-white");
  });

  it("highlights list tab when activeListId matches", () => {
    render(<FeedTabs lists={lists} activeListId="l1" />);
    const techLink = screen.getByText("Tech");
    expect(techLink.className).toContain("bg-white");
    const feedLink = screen.getByText("Feed");
    expect(feedLink.className).not.toContain("bg-white");
  });

  it("renders correct hrefs", () => {
    render(<FeedTabs lists={lists} />);
    expect(screen.getByText("Feed").closest("a")).toHaveAttribute("href", "/feed");
    expect(screen.getByText("Tech").closest("a")).toHaveAttribute("href", "/feed?list=l1");
    expect(screen.getByText("Friends").closest("a")).toHaveAttribute("href", "/feed?list=l2");
  });

  it("renders + link to manage lists", () => {
    render(<FeedTabs lists={lists} />);
    const plusLink = screen.getByText("+");
    expect(plusLink.closest("a")).toHaveAttribute("href", "/lists");
  });
});
