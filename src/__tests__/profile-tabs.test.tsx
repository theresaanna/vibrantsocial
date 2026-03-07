import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileTabs } from "@/components/profile-tabs";

describe("ProfileTabs", () => {
  it("renders Posts and Reposts tabs", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} />);
    expect(screen.getByText("Posts")).toBeInTheDocument();
    expect(screen.getByText("Reposts")).toBeInTheDocument();
  });

  it("Posts tab links to /{username}", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} />);
    const postsLink = screen.getByText("Posts").closest("a");
    expect(postsLink).toHaveAttribute("href", "/alice");
  });

  it("Reposts tab links to /{username}?tab=reposts", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} />);
    const repostsLink = screen.getByText("Reposts").closest("a");
    expect(repostsLink).toHaveAttribute("href", "/alice?tab=reposts");
  });

  it("Posts tab has active styling when activeTab is posts", () => {
    render(<ProfileTabs username="alice" activeTab="posts" hasCustomTheme={false} />);
    const postsLink = screen.getByText("Posts").closest("a");
    expect(postsLink?.className).toContain("border-zinc-900");
  });

  it("Reposts tab has active styling when activeTab is reposts", () => {
    render(<ProfileTabs username="alice" activeTab="reposts" hasCustomTheme={false} />);
    const repostsLink = screen.getByText("Reposts").closest("a");
    expect(repostsLink?.className).toContain("border-zinc-900");
  });
});
