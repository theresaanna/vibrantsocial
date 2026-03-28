import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketplaceGrid } from "@/components/marketplace-grid";
import type { MarketplaceMediaPost } from "@/app/marketplace/media-actions";

beforeAll(() => {
  global.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    constructor() {}
  } as unknown as typeof globalThis.IntersectionObserver;
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/components/framed-avatar", () => ({
  FramedAvatar: ({ alt }: { alt: string }) => <span data-testid="avatar">{alt}</span>,
}));

const makePost = (id: string, price: number): MarketplaceMediaPost => ({
  id,
  slug: `listing-${id}`,
  content: JSON.stringify({
    root: {
      children: [
        {
          type: "image",
          src: `https://example.com/image-${id}.jpg`,
          altText: `Image ${id}`,
        },
      ],
    },
  }),
  createdAt: new Date().toISOString(),
  isNsfw: false,
  isGraphicNudity: false,
  author: {
    id: `user-${id}`,
    username: `seller${id}`,
    displayName: `Seller ${id}`,
    name: null,
    image: null,
    avatar: null,
    profileFrameId: null,
  },
  marketplacePost: {
    id: `mp-${id}`,
    price,
    purchaseUrl: `https://example.com/buy/${id}`,
    shippingOption: "FREE",
    shippingPrice: null,
  },
});

describe("MarketplaceGrid", () => {
  it("renders empty state when no posts", () => {
    render(<MarketplaceGrid initialPosts={[]} initialHasMore={false} />);
    expect(screen.getByText("No marketplace listings yet.")).toBeInTheDocument();
  });

  it("renders grid with data-testid", () => {
    const posts = [makePost("1", 29.99)];
    render(<MarketplaceGrid initialPosts={posts} initialHasMore={false} />);
    expect(screen.getByTestId("marketplace-grid")).toBeInTheDocument();
  });

  it("renders grid items with data-testid", () => {
    const posts = [makePost("1", 29.99), makePost("2", 49.99)];
    render(<MarketplaceGrid initialPosts={posts} initialHasMore={false} />);
    const items = screen.getAllByTestId("marketplace-grid-item");
    expect(items).toHaveLength(2);
  });

  it("renders price badges", () => {
    const posts = [makePost("1", 29.99)];
    render(<MarketplaceGrid initialPosts={posts} initialHasMore={false} />);
    expect(screen.getByText("$29.99")).toBeInTheDocument();
  });

  it("renders 'no more listings' when hasMore is false", () => {
    const posts = [makePost("1", 10)];
    render(<MarketplaceGrid initialPosts={posts} initialHasMore={false} />);
    expect(screen.getByText("No more listings to show.")).toBeInTheDocument();
  });

  it("links to the post detail page", () => {
    const posts = [makePost("1", 15)];
    render(<MarketplaceGrid initialPosts={posts} initialHasMore={false} />);
    const link = screen.getByTestId("marketplace-grid-item");
    expect(link).toHaveAttribute("href", "/seller1/marketplace/listing-1");
  });
});
