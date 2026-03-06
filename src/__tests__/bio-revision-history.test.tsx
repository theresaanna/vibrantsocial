import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock server actions
const mockGetBioRevisions = vi.fn();
const mockRestoreBioRevision = vi.fn();

vi.mock("@/app/profile/actions", () => ({
  getBioRevisions: (...args: unknown[]) => mockGetBioRevisions(...args),
  restoreBioRevision: (...args: unknown[]) => mockRestoreBioRevision(...args),
}));

// Mock EditorContent
vi.mock("@/components/editor/EditorContent", () => ({
  EditorContent: ({ content }: { content: string }) => (
    <div data-testid="editor-content">{content}</div>
  ),
}));

import { BioRevisionHistory } from "@/components/bio-revision-history";

describe("BioRevisionHistory", () => {
  const onClose = vi.fn();
  const onRestore = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = "";
  });

  it("shows loading state initially", () => {
    mockGetBioRevisions.mockReturnValue(new Promise(() => {})); // never resolves
    render(<BioRevisionHistory onClose={onClose} onRestore={onRestore} />);

    expect(screen.getByText("Loading revisions...")).toBeTruthy();
  });

  it("shows empty state when no revisions exist", async () => {
    mockGetBioRevisions.mockResolvedValue([]);
    render(<BioRevisionHistory onClose={onClose} onRestore={onRestore} />);

    await waitFor(() => {
      expect(screen.getByText(/No previous revisions yet/)).toBeTruthy();
    });
  });

  it("renders revision list with timestamps", async () => {
    mockGetBioRevisions.mockResolvedValue([
      {
        id: "rev1",
        content: "Bio version 2",
        createdAt: new Date("2025-06-01T10:00:00Z"),
      },
      {
        id: "rev2",
        content: "Bio version 1",
        createdAt: new Date("2025-05-15T08:00:00Z"),
      },
    ]);

    render(<BioRevisionHistory onClose={onClose} onRestore={onRestore} />);

    await waitFor(() => {
      expect(screen.getByText("Revision History")).toBeTruthy();
      // Should show the preview of the first (auto-selected) revision
      expect(screen.getByTestId("editor-content")).toBeTruthy();
    });
  });

  it("shows preview when a revision is clicked", async () => {
    mockGetBioRevisions.mockResolvedValue([
      {
        id: "rev1",
        content: "Bio version 2",
        createdAt: new Date("2025-06-01T10:00:00Z"),
      },
      {
        id: "rev2",
        content: "Bio version 1",
        createdAt: new Date("2025-05-15T08:00:00Z"),
      },
    ]);

    render(<BioRevisionHistory onClose={onClose} onRestore={onRestore} />);

    await waitFor(() => {
      expect(screen.getByTestId("editor-content")).toBeTruthy();
    });

    // First revision is auto-selected, preview should show its content
    expect(screen.getByTestId("editor-content").textContent).toBe(
      "Bio version 2"
    );
  });

  it("shows Restore button for selected revision", async () => {
    mockGetBioRevisions.mockResolvedValue([
      {
        id: "rev1",
        content: "Bio v2",
        createdAt: new Date("2025-06-01T10:00:00Z"),
      },
    ]);

    render(<BioRevisionHistory onClose={onClose} onRestore={onRestore} />);

    await waitFor(() => {
      expect(screen.getByText("Restore this version")).toBeTruthy();
    });
  });

  it("calls restoreBioRevision and onRestore when Restore is clicked", async () => {
    mockGetBioRevisions.mockResolvedValue([
      {
        id: "rev1",
        content: "Bio v2",
        createdAt: new Date("2025-06-01T10:00:00Z"),
      },
    ]);
    mockRestoreBioRevision.mockResolvedValue({
      success: true,
      message: "Bio restored",
      restoredContent: "Bio v2",
    });

    render(<BioRevisionHistory onClose={onClose} onRestore={onRestore} />);

    await waitFor(() => {
      expect(screen.getByText("Restore this version")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Restore this version"));

    await waitFor(() => {
      expect(mockRestoreBioRevision).toHaveBeenCalledWith("rev1");
      expect(onRestore).toHaveBeenCalledWith("Bio v2");
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("closes on Escape key", async () => {
    mockGetBioRevisions.mockResolvedValue([]);
    render(<BioRevisionHistory onClose={onClose} onRestore={onRestore} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on overlay click", async () => {
    mockGetBioRevisions.mockResolvedValue([]);
    render(<BioRevisionHistory onClose={onClose} onRestore={onRestore} />);

    const overlay = document.body.querySelector(
      ".bg-black\\/50"
    ) as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("locks body scroll when open", () => {
    mockGetBioRevisions.mockResolvedValue([]);
    render(<BioRevisionHistory onClose={onClose} onRestore={onRestore} />);

    expect(document.body.style.overflow).toBe("hidden");
  });

  it("has Revision History title in header", () => {
    mockGetBioRevisions.mockResolvedValue([]);
    render(<BioRevisionHistory onClose={onClose} onRestore={onRestore} />);

    expect(screen.getByText("Revision History")).toBeTruthy();
  });
});
