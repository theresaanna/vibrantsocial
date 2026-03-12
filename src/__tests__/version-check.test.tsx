import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VersionCheck } from "@/components/version-check";

vi.mock("@/hooks/use-app-version");

import { useAppVersion } from "@/hooks/use-app-version";

describe("VersionCheck", () => {
  it("renders nothing when there is no update", () => {
    vi.mocked(useAppVersion).mockReturnValue({ hasUpdate: false });

    const { container } = render(<VersionCheck />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the update banner when there is an update", () => {
    vi.mocked(useAppVersion).mockReturnValue({ hasUpdate: true });

    render(<VersionCheck />);
    expect(
      screen.getByText("A new version of VibrantSocial is available")
    ).toBeInTheDocument();
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });
});
