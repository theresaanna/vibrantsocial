import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileTabs } from "@/components/profile-tabs";

describe("ProfileTabs", () => {
  it("renders Posts and Reposts tabs", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showNsfwTab={false} />);
    expect(screen.getByText("Posts")).toBeInTheDocument();
    expect(screen.getByText("Reposts")).toBeInTheDocument();
  });

  it("Posts tab links to /{username}", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showNsfwTab={false} />);
    const postsLink = screen.getByText("Posts").closest("a");
    expect(postsLink).toHaveAttribute("href", "/alice");
  });

  it("Reposts tab links to /{username}?tab=reposts", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showNsfwTab={false} />);
    const repostsLink = screen.getByText("Reposts").closest("a");
    expect(repostsLink).toHaveAttribute("href", "/alice?tab=reposts");
  });

  it("Posts tab has active styling when activeTab is posts", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showNsfwTab={false} />);
    const postsLink = screen.getByText("Posts").closest("a");
    expect(postsLink?.className).toContain("border-zinc-900");
  });

  it("Reposts tab has active styling when activeTab is reposts", () => {
    render(<ProfileTabs username="alice" activeTab="reposts" hasCustomTheme={false} showNsfwTab={false} />);
    const repostsLink = screen.getByText("Reposts").closest("a");
    expect(repostsLink?.className).toContain("border-zinc-900");
  });

  it("does not show NSFW tab when showNsfwTab is false", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showNsfwTab={false} />);
    expect(screen.queryByText("NSFW")).not.toBeInTheDocument();
  });

  it("shows NSFW tab when showNsfwTab is true", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showNsfwTab={true} />);
    expect(screen.getByText("NSFW")).toBeInTheDocument();
  });

  it("NSFW tab links to /{username}?tab=nsfw", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showNsfwTab={true} />);
    const nsfwLink = screen.getByText("NSFW").closest("a");
    expect(nsfwLink).toHaveAttribute("href", "/alice?tab=nsfw");
  });

  it("NSFW tab has active styling when activeTab is nsfw", () => {
    render(<ProfileTabs username="alice" activeTab="nsfw" hasCustomTheme={false} showNsfwTab={true} />);
    const nsfwLink = screen.getByText("NSFW").closest("a");
    expect(nsfwLink?.className).toContain("border-zinc-900");
  });
});
