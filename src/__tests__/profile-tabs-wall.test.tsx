import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { ProfileTabs } from "@/components/profile-tabs";

const defaultProps = {
  username: "testuser",
  activeTab: "posts" as const,
  hasCustomTheme: false,
  showSensitiveTab: false,
  showNsfwTab: false,
  showGraphicTab: false,
};

describe("ProfileTabs - wall tab", () => {
  it("renders wall tab when showWallTab is true", () => {
    render(<ProfileTabs {...defaultProps} showWallTab={true} />);
    expect(screen.getByText("Wall")).toBeInTheDocument();
  });

  it("does not render wall tab when showWallTab is false", () => {
    render(<ProfileTabs {...defaultProps} showWallTab={false} />);
    expect(screen.queryByText("Wall")).not.toBeInTheDocument();
  });

  it("does not render wall tab when showWallTab is undefined", () => {
    render(<ProfileTabs {...defaultProps} />);
    expect(screen.queryByText("Wall")).not.toBeInTheDocument();
  });

  it("links to correct URL for wall tab", () => {
    render(<ProfileTabs {...defaultProps} showWallTab={true} />);
    const wallLink = screen.getByText("Wall").closest("a");
    expect(wallLink).toHaveAttribute("href", "/testuser?tab=wall");
  });

  it("applies active styles when wall tab is selected", () => {
    render(
      <ProfileTabs
        {...defaultProps}
        activeTab="wall"
        showWallTab={true}
      />
    );
    const wallLink = screen.getByText("Wall");
    expect(wallLink.className).toContain("border-fuchsia-600");
  });

  it("applies inactive styles when wall tab is not selected", () => {
    render(
      <ProfileTabs
        {...defaultProps}
        activeTab="posts"
        showWallTab={true}
      />
    );
    const wallLink = screen.getByText("Wall");
    expect(wallLink.className).toContain("border-transparent");
  });
});
