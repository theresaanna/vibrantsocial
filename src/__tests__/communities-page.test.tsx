import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { TagCloud } from "@/app/communities/tag-cloud";

describe("TagCloud", () => {
  it("renders the tag cloud container", () => {
    render(<TagCloud tags={[{ name: "react", count: 5 }]} />);
    expect(screen.getByTestId("tag-cloud")).toBeInTheDocument();
  });

  it("renders tag pills with names and counts", () => {
    render(
      <TagCloud
        tags={[
          { name: "react", count: 5 },
          { name: "vue", count: 3 },
        ]}
      />
    );
    expect(screen.getByText("#react")).toBeInTheDocument();
    expect(screen.getByText("#vue")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders links to tag pages", () => {
    render(<TagCloud tags={[{ name: "react", count: 5 }]} />);
    const link = screen.getByRole("link", { name: /#react/i });
    expect(link).toHaveAttribute("href", "/tag/react");
  });

  it("handles empty tags array", () => {
    render(<TagCloud tags={[]} />);
    expect(screen.getByTestId("tag-cloud")).toBeInTheDocument();
  });
});
