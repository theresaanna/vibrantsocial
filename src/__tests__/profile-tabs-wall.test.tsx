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

describe("ProfileTabs - wall and reposts tabs removed", () => {
  it("does not render wall tab", () => {
    render(<ProfileTabs {...defaultProps} />);
    expect(screen.queryByText("Wall")).not.toBeInTheDocument();
  });

  it("does not render reposts tab", () => {
    render(<ProfileTabs {...defaultProps} />);
    expect(screen.queryByText("Reposts")).not.toBeInTheDocument();
  });

  it("renders posts tab", () => {
    render(<ProfileTabs {...defaultProps} />);
    expect(screen.getByText("Posts")).toBeInTheDocument();
  });
});
