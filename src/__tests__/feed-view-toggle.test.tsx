import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedViewToggle } from "@/components/feed-view-toggle";

describe("FeedViewToggle", () => {
  it("renders Posts and Media tabs", () => {
    render(<FeedViewToggle activeView="posts" onViewChange={vi.fn()} />);

    expect(screen.getByRole("tab", { name: "Posts" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Media" })).toBeInTheDocument();
  });

  it("marks Posts tab as selected when activeView is posts", () => {
    render(<FeedViewToggle activeView="posts" onViewChange={vi.fn()} />);

    expect(screen.getByRole("tab", { name: "Posts" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Media" })).toHaveAttribute("aria-selected", "false");
  });

  it("marks Media tab as selected when activeView is media", () => {
    render(<FeedViewToggle activeView="media" onViewChange={vi.fn()} />);

    expect(screen.getByRole("tab", { name: "Posts" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Media" })).toHaveAttribute("aria-selected", "true");
  });

  it("calls onViewChange with 'media' when Media tab is clicked", async () => {
    const onViewChange = vi.fn();
    render(<FeedViewToggle activeView="posts" onViewChange={onViewChange} />);

    await userEvent.click(screen.getByRole("tab", { name: "Media" }));

    expect(onViewChange).toHaveBeenCalledWith("media");
  });

  it("calls onViewChange with 'posts' when Posts tab is clicked", async () => {
    const onViewChange = vi.fn();
    render(<FeedViewToggle activeView="media" onViewChange={onViewChange} />);

    await userEvent.click(screen.getByRole("tab", { name: "Posts" }));

    expect(onViewChange).toHaveBeenCalledWith("posts");
  });

  it("has correct tablist role on container", () => {
    render(<FeedViewToggle activeView="posts" onViewChange={vi.fn()} />);

    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });
});
