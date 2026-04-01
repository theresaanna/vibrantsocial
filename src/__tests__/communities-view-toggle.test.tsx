import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommunitiesViewToggle } from "@/app/communities/communities-view-toggle";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("CommunitiesViewToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Tags, Media, Discussions, and Newcomers tabs", () => {
    render(<CommunitiesViewToggle activeView="tags" />);

    expect(screen.getByTestId("communities-view-tags")).toBeInTheDocument();
    expect(screen.getByTestId("communities-view-media")).toBeInTheDocument();
    expect(screen.getByTestId("communities-view-discussions")).toBeInTheDocument();
    expect(screen.getByTestId("communities-view-newcomers")).toBeInTheDocument();
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("Media")).toBeInTheDocument();
    expect(screen.getByText("Discussions")).toBeInTheDocument();
    expect(screen.getByText("Newcomers")).toBeInTheDocument();
  });

  it("marks Tags tab as selected by default", () => {
    render(<CommunitiesViewToggle activeView="tags" />);

    expect(screen.getByTestId("communities-view-tags")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("communities-view-media")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("communities-view-discussions")).toHaveAttribute("aria-selected", "false");
  });

  it("marks Media tab as selected when activeView is media", () => {
    render(<CommunitiesViewToggle activeView="media" />);

    expect(screen.getByTestId("communities-view-tags")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("communities-view-media")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("communities-view-discussions")).toHaveAttribute("aria-selected", "false");
  });

  it("marks Discussions tab as selected when activeView is discussions", () => {
    render(<CommunitiesViewToggle activeView="discussions" />);

    expect(screen.getByTestId("communities-view-tags")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("communities-view-media")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("communities-view-discussions")).toHaveAttribute("aria-selected", "true");
  });

  it("navigates to /communities?view=media when Media is clicked", () => {
    render(<CommunitiesViewToggle activeView="tags" />);

    fireEvent.click(screen.getByTestId("communities-view-media"));
    expect(mockPush).toHaveBeenCalledWith("/communities?view=media");
  });

  it("navigates to /communities?view=discussions when Discussions is clicked", () => {
    render(<CommunitiesViewToggle activeView="tags" />);

    fireEvent.click(screen.getByTestId("communities-view-discussions"));
    expect(mockPush).toHaveBeenCalledWith("/communities?view=discussions");
  });

  it("navigates to /communities when Tags is clicked", () => {
    render(<CommunitiesViewToggle activeView="media" />);

    fireEvent.click(screen.getByTestId("communities-view-tags"));
    expect(mockPush).toHaveBeenCalledWith("/communities");
  });

  it("has correct ARIA role tablist", () => {
    render(<CommunitiesViewToggle activeView="tags" />);

    expect(screen.getByRole("tablist")).toHaveAttribute("aria-label", "Communities view");
  });

  it("marks Newcomers tab as selected when activeView is newcomers", () => {
    render(<CommunitiesViewToggle activeView="newcomers" />);

    expect(screen.getByTestId("communities-view-tags")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("communities-view-media")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("communities-view-discussions")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("communities-view-newcomers")).toHaveAttribute("aria-selected", "true");
  });

  it("navigates to /communities?view=newcomers when Newcomers is clicked", () => {
    render(<CommunitiesViewToggle activeView="tags" />);

    fireEvent.click(screen.getByTestId("communities-view-newcomers"));
    expect(mockPush).toHaveBeenCalledWith("/communities?view=newcomers");
  });

  it("renders tab buttons with role tab", () => {
    render(<CommunitiesViewToggle activeView="tags" />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
  });
});
