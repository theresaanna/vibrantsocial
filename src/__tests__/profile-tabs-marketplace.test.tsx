import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileTabs } from "@/components/profile-tabs";

describe("ProfileTabs marketplace tab", () => {
  const baseProps = {
    username: "testuser",
    hasCustomTheme: false,
    showWallTab: false,
    showSensitiveTab: false,
    showNsfwTab: false,
    showGraphicTab: false,
    showMarketplaceTab: false,
  };

  it("does not render marketplace tab when showMarketplaceTab is false", () => {
    render(<ProfileTabs {...baseProps} activeTab="posts" />);
    expect(screen.queryByTestId("profile-marketplace-tab")).not.toBeInTheDocument();
  });

  it("renders marketplace tab when showMarketplaceTab is true", () => {
    render(<ProfileTabs {...baseProps} showMarketplaceTab={true} activeTab="posts" />);
    expect(screen.getByTestId("profile-marketplace-tab")).toBeInTheDocument();
    expect(screen.getByText("Marketplace")).toBeInTheDocument();
  });

  it("links to the marketplace tab URL", () => {
    render(<ProfileTabs {...baseProps} showMarketplaceTab={true} activeTab="posts" />);
    const tab = screen.getByTestId("profile-marketplace-tab");
    expect(tab).toHaveAttribute("href", "/testuser?tab=marketplace");
  });

  it("highlights marketplace tab when activeTab is marketplace", () => {
    render(<ProfileTabs {...baseProps} showMarketplaceTab={true} activeTab="marketplace" />);
    const tab = screen.getByTestId("profile-marketplace-tab");
    expect(tab.className).toContain("bg-fuchsia-600");
  });

  it("does not highlight marketplace tab when activeTab is posts", () => {
    render(<ProfileTabs {...baseProps} showMarketplaceTab={true} activeTab="posts" />);
    const tab = screen.getByTestId("profile-marketplace-tab");
    expect(tab.className).not.toContain("bg-fuchsia-600");
  });
});
