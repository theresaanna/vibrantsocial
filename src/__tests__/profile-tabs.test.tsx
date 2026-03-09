import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileTabs } from "@/components/profile-tabs";

describe("ProfileTabs", () => {
  it("renders Posts and Reposts tabs", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showSensitiveTab={false} showNsfwTab={false} showGraphicTab={false} />);
    expect(screen.getByText("Posts")).toBeInTheDocument();
    expect(screen.getByText("Reposts")).toBeInTheDocument();
  });

  it("Posts tab links to /{username}", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showSensitiveTab={false} showNsfwTab={false} showGraphicTab={false} />);
    const postsLink = screen.getByText("Posts").closest("a");
    expect(postsLink).toHaveAttribute("href", "/alice");
  });

  it("Reposts tab links to /{username}?tab=reposts", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showSensitiveTab={false} showNsfwTab={false} showGraphicTab={false} />);
    const repostsLink = screen.getByText("Reposts").closest("a");
    expect(repostsLink).toHaveAttribute("href", "/alice?tab=reposts");
  });

  it("Posts tab has active styling when activeTab is posts", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showSensitiveTab={false} showNsfwTab={false} showGraphicTab={false} />);
    const postsLink = screen.getByText("Posts").closest("a");
    expect(postsLink?.className).toContain("border-zinc-900");
  });

  it("Reposts tab has active styling when activeTab is reposts", () => {
    render(<ProfileTabs username="alice" activeTab="reposts" hasCustomTheme={false} showSensitiveTab={false} showNsfwTab={false} showGraphicTab={false} />);
    const repostsLink = screen.getByText("Reposts").closest("a");
    expect(repostsLink?.className).toContain("border-zinc-900");
  });

  it("does not show NSFW tab when showNsfwTab is false", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showSensitiveTab={false} showNsfwTab={false} showGraphicTab={false} />);
    expect(screen.queryByText("NSFW")).not.toBeInTheDocument();
  });

  it("shows NSFW tab when showNsfwTab is true", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showSensitiveTab={false} showNsfwTab={true} showGraphicTab={false} />);
    expect(screen.getByText("NSFW")).toBeInTheDocument();
  });

  it("NSFW tab links to /{username}?tab=nsfw", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showSensitiveTab={false} showNsfwTab={true} showGraphicTab={false} />);
    const nsfwLink = screen.getByText("NSFW").closest("a");
    expect(nsfwLink).toHaveAttribute("href", "/alice?tab=nsfw");
  });

  it("NSFW tab has active styling when activeTab is nsfw", () => {
    render(<ProfileTabs username="alice" activeTab="nsfw" hasCustomTheme={false} showSensitiveTab={false} showNsfwTab={true} showGraphicTab={false} />);
    const nsfwLink = screen.getByText("NSFW").closest("a");
    expect(nsfwLink?.className).toContain("border-zinc-900");
  });

  it("does not show Sensitive tab when showSensitiveTab is false", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showSensitiveTab={false} showNsfwTab={false} showGraphicTab={false} />);
    expect(screen.queryByText("Sensitive")).not.toBeInTheDocument();
  });

  it("shows Sensitive tab when showSensitiveTab is true", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showSensitiveTab={true} showNsfwTab={false} showGraphicTab={false} />);
    expect(screen.getByText("Sensitive")).toBeInTheDocument();
  });

  it("Sensitive tab links to /{username}?tab=sensitive", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showSensitiveTab={true} showNsfwTab={false} showGraphicTab={false} />);
    const link = screen.getByText("Sensitive").closest("a");
    expect(link).toHaveAttribute("href", "/alice?tab=sensitive");
  });

  it("does not show Graphic/Explicit tab when showGraphicTab is false", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showSensitiveTab={false} showNsfwTab={false} showGraphicTab={false} />);
    expect(screen.queryByText("Graphic/Explicit")).not.toBeInTheDocument();
  });

  it("shows Graphic/Explicit tab when showGraphicTab is true", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showSensitiveTab={false} showNsfwTab={false} showGraphicTab={true} />);
    expect(screen.getByText("Graphic/Explicit")).toBeInTheDocument();
  });

  it("Graphic/Explicit tab links to /{username}?tab=graphic", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} showSensitiveTab={false} showNsfwTab={false} showGraphicTab={true} />);
    const link = screen.getByText("Graphic/Explicit").closest("a");
    expect(link).toHaveAttribute("href", "/alice?tab=graphic");
  });
});
