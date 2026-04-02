import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LinksForm } from "@/app/profile/links/links-form";

vi.mock("@/app/profile/links/actions", () => ({
  updateLinksPage: vi.fn(),
}));

describe("LinksForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with initial data", () => {
    render(
      <LinksForm
        enabled={true}
        bio="My bio"
        links={[
          { id: "l1", title: "Website", url: "https://example.com" },
        ]}
        username="alice"
        sensitiveLinks={false}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).toBeChecked(); // Enable toggle

    const bioInput = screen.getByPlaceholderText(/short bio/i);
    expect(bioInput).toHaveValue("My bio");

    expect(screen.getByDisplayValue("Website")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://example.com")).toBeInTheDocument();
  });

  it("shows subdomain URL with username", () => {
    render(
      <LinksForm enabled={false} bio="" links={[]} username="alice" sensitiveLinks={false} />
    );

    expect(
      screen.getByText(/links\.vibrantsocial\.app\/alice/)
    ).toBeInTheDocument();
  });

  it("disables checkbox when no username", () => {
    render(
      <LinksForm enabled={false} bio="" links={[]} username={null} sensitiveLinks={false} />
    );

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).toBeDisabled();
    expect(screen.getByText(/Set a username first/)).toBeInTheDocument();
  });

  it("adds a new link when Add Link is clicked", async () => {
    const user = userEvent.setup();
    render(
      <LinksForm enabled={false} bio="" links={[]} username="alice" sensitiveLinks={false} />
    );

    // Starts with one empty entry
    expect(screen.getAllByTestId("link-entry")).toHaveLength(1);

    await user.click(screen.getByTestId("add-link-btn"));
    expect(screen.getAllByTestId("link-entry")).toHaveLength(2);
  });

  it("removes a link when remove button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <LinksForm
        enabled={false}
        bio=""
        links={[
          { id: "l1", title: "Link 1", url: "https://one.com" },
          { id: "l2", title: "Link 2", url: "https://two.com" },
        ]}
        username="alice"
        sensitiveLinks={false}
      />
    );

    expect(screen.getAllByTestId("link-entry")).toHaveLength(2);

    const removeButtons = screen.getAllByTestId("remove-link-btn");
    await user.click(removeButtons[0]);

    expect(screen.getAllByTestId("link-entry")).toHaveLength(1);
    expect(screen.getByDisplayValue("Link 2")).toBeInTheDocument();
  });

  it("renders Save button", () => {
    render(
      <LinksForm enabled={false} bio="" links={[]} username="alice" sensitiveLinks={false} />
    );

    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });

  describe("Sensitive link safety toggle", () => {
    it("renders the toggle with description", () => {
      render(
        <LinksForm enabled={false} bio="" links={[]} username="alice" sensitiveLinks={false} />
      );

      expect(screen.getByText("Sensitive link safety")).toBeInTheDocument();
      expect(screen.getByText(/Hide links when viewed in social media app browsers/)).toBeInTheDocument();
    });

    it("is unchecked when sensitiveLinks is false", () => {
      render(
        <LinksForm enabled={false} bio="" links={[]} username="alice" sensitiveLinks={false} />
      );

      const toggle = screen.getByTestId("sensitive-links-toggle");
      expect(toggle).not.toBeChecked();
    });

    it("is checked when sensitiveLinks is true", () => {
      render(
        <LinksForm enabled={false} bio="" links={[]} username="alice" sensitiveLinks={true} />
      );

      const toggle = screen.getByTestId("sensitive-links-toggle");
      expect(toggle).toBeChecked();
    });

    it("has the correct form field name", () => {
      render(
        <LinksForm enabled={false} bio="" links={[]} username="alice" sensitiveLinks={false} />
      );

      const toggle = screen.getByTestId("sensitive-links-toggle");
      expect(toggle).toHaveAttribute("name", "linksPageSensitiveLinks");
    });
  });
});
