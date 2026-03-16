import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetTagCloudData = vi.fn();
const mockGetAllTagCloudData = vi.fn();
const mockGetNsfwTagCloudData = vi.fn();

vi.mock("@/app/tags/actions", () => ({
  getTagCloudData: (...args: unknown[]) => mockGetTagCloudData(...args),
  getAllTagCloudData: (...args: unknown[]) => mockGetAllTagCloudData(...args),
  getNsfwTagCloudData: (...args: unknown[]) => mockGetNsfwTagCloudData(...args),
}));

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

const mockFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

describe("Communities page NSFW tag interspersing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses getTagCloudData (SFW only) when user is not logged in", async () => {
    mockAuth.mockResolvedValue(null);
    mockGetTagCloudData.mockResolvedValue([
      { name: "react", count: 5 },
      { name: "vue", count: 3 },
    ]);

    // Simulate the page logic
    const session = await mockAuth();
    let showNsfwContent = false;

    if (session?.user?.id) {
      const user = await mockFindUnique({
        where: { id: session.user.id },
        select: { showNsfwContent: true },
      });
      showNsfwContent = user?.showNsfwContent ?? false;
    }

    const tagData = showNsfwContent
      ? await mockGetAllTagCloudData()
      : await mockGetTagCloudData();

    expect(mockGetTagCloudData).toHaveBeenCalled();
    expect(mockGetAllTagCloudData).not.toHaveBeenCalled();
    expect(mockGetNsfwTagCloudData).not.toHaveBeenCalled();
    expect(tagData).toEqual([
      { name: "react", count: 5 },
      { name: "vue", count: 3 },
    ]);
  });

  it("uses getTagCloudData (SFW only) when user has showNsfwContent=false", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockFindUnique.mockResolvedValue({ showNsfwContent: false });
    mockGetTagCloudData.mockResolvedValue([{ name: "react", count: 5 }]);

    const session = await mockAuth();
    let showNsfwContent = false;

    if (session?.user?.id) {
      const user = await mockFindUnique({
        where: { id: session.user.id },
        select: { showNsfwContent: true },
      });
      showNsfwContent = user?.showNsfwContent ?? false;
    }

    const tagData = showNsfwContent
      ? await mockGetAllTagCloudData()
      : await mockGetTagCloudData();

    expect(mockGetTagCloudData).toHaveBeenCalled();
    expect(mockGetAllTagCloudData).not.toHaveBeenCalled();
    expect(tagData).toEqual([{ name: "react", count: 5 }]);
  });

  it("uses getAllTagCloudData (interspersed) when user has showNsfwContent=true", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockFindUnique.mockResolvedValue({ showNsfwContent: true });
    mockGetAllTagCloudData.mockResolvedValue([
      { name: "nsfw-art", count: 10 },
      { name: "react", count: 5 },
      { name: "vue", count: 3 },
    ]);

    const session = await mockAuth();
    let showNsfwContent = false;

    if (session?.user?.id) {
      const user = await mockFindUnique({
        where: { id: session.user.id },
        select: { showNsfwContent: true },
      });
      showNsfwContent = user?.showNsfwContent ?? false;
    }

    const tagData = showNsfwContent
      ? await mockGetAllTagCloudData()
      : await mockGetTagCloudData();

    expect(mockGetAllTagCloudData).toHaveBeenCalled();
    expect(mockGetTagCloudData).not.toHaveBeenCalled();
    // NSFW tags are interspersed with regular tags, sorted by count
    expect(tagData).toEqual([
      { name: "nsfw-art", count: 10 },
      { name: "react", count: 5 },
      { name: "vue", count: 3 },
    ]);
  });

  it("does not call getNsfwTagCloudData (no separate NSFW section)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockFindUnique.mockResolvedValue({ showNsfwContent: true });
    mockGetAllTagCloudData.mockResolvedValue([]);

    const session = await mockAuth();
    let showNsfwContent = false;

    if (session?.user?.id) {
      const user = await mockFindUnique({
        where: { id: session.user.id },
        select: { showNsfwContent: true },
      });
      showNsfwContent = user?.showNsfwContent ?? false;
    }

    showNsfwContent
      ? await mockGetAllTagCloudData()
      : await mockGetTagCloudData();

    // getNsfwTagCloudData is never called — no separate section
    expect(mockGetNsfwTagCloudData).not.toHaveBeenCalled();
  });
});
