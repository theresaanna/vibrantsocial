import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Set Upstash env vars so that @/lib/cache and @/lib/rate-limit
// instantiate their Redis clients (which tests then mock)
process.env.UPSTASH_REDIS_REST_URL ??= "http://localhost:0";
process.env.UPSTASH_REDIS_REST_TOKEN ??= "test-token";

// Polyfill ResizeObserver for jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
  useRouter: vi.fn().mockReturnValue({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: vi.fn().mockReturnValue("/"),
}));
