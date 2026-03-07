import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock ResizeObserver for jsdom
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

// Mock d3 force simulation
vi.mock("d3", () => ({
  forceSimulation: () => ({
    force: function() { return this; },
    on: function(_: string, cb: () => void) { cb(); return this; },
    alpha: function() { return this; },
    restart: function() { return this; },
    stop: function() { return this; },
  }),
  forceCenter: () => ({}),
  forceCollide: () => ({
    strength: function() { return this; },
  }),
  forceManyBody: () => ({
    strength: function() { return this; },
  }),
  forceX: () => ({
    strength: function() { return this; },
  }),
  forceY: () => ({
    strength: function() { return this; },
  }),
  scaleSqrt: () => {
    const fn = (v: number) => v * 2;
    fn.domain = function() { return this; };
    fn.range = function() { return fn; };
    return fn;
  },
  scaleSequential: () => {
    const fn = () => "#ff0000";
    fn.domain = function() { return fn; };
    return fn;
  },
  interpolateWarm: () => "#ff0000",
}));

import { TagCloud } from "@/app/communities/tag-cloud";

describe("TagCloud", () => {
  it("renders the tag cloud container", () => {
    render(<TagCloud tags={[{ name: "react", count: 5 }]} />);
    expect(screen.getByTestId("tag-cloud")).toBeInTheDocument();
  });

  it("renders SVG element", () => {
    render(
      <TagCloud
        tags={[
          { name: "react", count: 5 },
          { name: "vue", count: 3 },
        ]}
      />
    );
    const svg = screen.getByTestId("tag-cloud").querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("handles empty tags array", () => {
    render(<TagCloud tags={[]} />);
    expect(screen.getByTestId("tag-cloud")).toBeInTheDocument();
  });
});
