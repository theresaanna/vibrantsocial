import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StyledName } from "@/components/styled-name";

describe("StyledName", () => {
  it("renders children without wrapper when fontId is null", () => {
    render(<StyledName fontId={null}>Test User</StyledName>);
    expect(screen.getByText("Test User")).toBeInTheDocument();
    // Should not be wrapped in a span with style
    const el = screen.getByText("Test User");
    expect(el.style.fontFamily).toBe("");
  });

  it("renders children without wrapper when fontId is undefined", () => {
    render(<StyledName fontId={undefined}>Test User</StyledName>);
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("renders children with font-family style when fontId is valid", () => {
    render(<StyledName fontId="sofadi-one">Test User</StyledName>);
    const el = screen.getByText("Test User");
    expect(el.tagName).toBe("SPAN");
    expect(el.style.fontFamily).toContain("Sofadi One");
  });

  it("renders children without wrapper when fontId is invalid", () => {
    render(<StyledName fontId="nonexistent">Test User</StyledName>);
    const el = screen.getByText("Test User");
    expect(el.style.fontFamily).toBe("");
  });

  it("applies correct font family for premium font", () => {
    render(<StyledName fontId="gugi">Premium User</StyledName>);
    const el = screen.getByText("Premium User");
    expect(el.style.fontFamily).toContain("Gugi");
  });
});
