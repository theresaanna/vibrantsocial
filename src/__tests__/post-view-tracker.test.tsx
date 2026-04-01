import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostViewTracker } from "@/components/post-view-tracker";

const mockRecordPostView = vi.fn().mockResolvedValue(undefined);

vi.mock("@/app/feed/view-actions", () => ({
  recordPostView: (...args: unknown[]) => mockRecordPostView(...args),
}));

// Stub IntersectionObserver
let observerCallback: IntersectionObserverCallback;

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: readonly number[] = [];
  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}

Object.defineProperty(globalThis, "IntersectionObserver", {
  value: MockIntersectionObserver,
  writable: true,
});

function simulateIntersection(isIntersecting: boolean) {
  observerCallback(
    [{ isIntersecting } as IntersectionObserverEntry],
    new MockIntersectionObserver(() => {}),
  );
}

describe("PostViewTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, "referrer", {
      value: "https://external.com",
      configurable: true,
    });
  });

  it("renders children", () => {
    render(
      <PostViewTracker postId="post1" source="feed">
        <div data-testid="child">Hello</div>
      </PostViewTracker>,
    );

    expect(screen.getByTestId("child")).toHaveTextContent("Hello");
  });

  it("records a view when the element becomes visible", () => {
    render(
      <PostViewTracker postId="post1" source="feed">
        <div>Content</div>
      </PostViewTracker>,
    );

    simulateIntersection(true);

    expect(mockRecordPostView).toHaveBeenCalledOnce();
    expect(mockRecordPostView).toHaveBeenCalledWith({
      postId: "post1",
      source: "feed",
      referrer: "https://external.com",
    });
  });

  it("does not record a view when the element is not visible", () => {
    render(
      <PostViewTracker postId="post1" source="feed">
        <div>Content</div>
      </PostViewTracker>,
    );

    simulateIntersection(false);

    expect(mockRecordPostView).not.toHaveBeenCalled();
  });

  it("records only once even with multiple intersections", () => {
    render(
      <PostViewTracker postId="post1" source="feed">
        <div>Content</div>
      </PostViewTracker>,
    );

    simulateIntersection(true);
    simulateIntersection(true);
    simulateIntersection(true);

    expect(mockRecordPostView).toHaveBeenCalledOnce();
  });

  it("passes the correct source", () => {
    render(
      <PostViewTracker postId="post1" source="profile">
        <div>Content</div>
      </PostViewTracker>,
    );

    simulateIntersection(true);

    expect(mockRecordPostView).toHaveBeenCalledWith(
      expect.objectContaining({ source: "profile" }),
    );
  });
});
