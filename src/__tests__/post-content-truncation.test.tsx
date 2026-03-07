import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PostContent } from "@/components/post-content";

vi.mock("@/components/editor/EditorContent", () => ({
  EditorContent: ({ content }: { content: string }) => (
    <div data-testid="editor-content">{content}</div>
  ),
}));

describe("PostContent - truncation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("applies truncation class by default", () => {
    render(<PostContent content="Hello world" />);
    const container = screen.getByTestId("post-content-container");
    expect(container.className).toContain("max-h-[50vh]");
    expect(container.className).toContain("overflow-hidden");
  });

  it("does not apply truncation class when truncate is false", () => {
    render(<PostContent content="Hello world" truncate={false} />);
    const container = screen.getByTestId("post-content-container");
    expect(container.className).not.toContain("max-h-[50vh]");
    expect(container.className).not.toContain("overflow-hidden");
  });

  it("does not show 'Show more' button when content fits", () => {
    render(<PostContent content="Short content" />);
    expect(screen.queryByTestId("show-more-button")).not.toBeInTheDocument();
  });

  it("shows 'Show more' button when content overflows", () => {
    // Mock scrollHeight > clientHeight to simulate overflow
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollHeight"
    );

    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        if (this.dataset.testid === "post-content-container") {
          return 1000;
        }
        return 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        if (this.dataset.testid === "post-content-container") {
          return 400;
        }
        return 0;
      },
    });

    render(<PostContent content="Very long content" />);

    expect(screen.getByTestId("show-more-button")).toBeInTheDocument();
    expect(screen.getByText("Show more")).toBeInTheDocument();

    // Restore
    if (originalDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        "scrollHeight",
        originalDescriptor
      );
    }
  });

  it("expands content when 'Show more' is clicked", () => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        if (this.dataset.testid === "post-content-container") {
          return 1000;
        }
        return 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        if (this.dataset.testid === "post-content-container") {
          return 400;
        }
        return 0;
      },
    });

    render(<PostContent content="Very long content" />);

    const showMoreButton = screen.getByTestId("show-more-button");
    fireEvent.click(showMoreButton);

    // After expanding, truncation class should be removed
    const container = screen.getByTestId("post-content-container");
    expect(container.className).not.toContain("max-h-[50vh]");
    expect(container.className).not.toContain("overflow-hidden");

    // Show more button should be gone
    expect(screen.queryByTestId("show-more-button")).not.toBeInTheDocument();
  });

  it("does not show 'Show more' when truncate is false even with long content", () => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        return 1000;
      },
    });

    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return 400;
      },
    });

    render(<PostContent content="Very long content" truncate={false} />);

    expect(screen.queryByTestId("show-more-button")).not.toBeInTheDocument();
  });

  it("renders EditorContent with the provided content", () => {
    render(<PostContent content="My post content" />);
    expect(screen.getByTestId("editor-content")).toHaveTextContent(
      "My post content"
    );
  });
});
