import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";

const mockSubmitReport = vi.fn();

vi.mock("@/app/report/actions", () => ({
  submitReport: (...args: unknown[]) => mockSubmitReport(...args),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

let capturedFormAction: ((formData: FormData) => Promise<void>) | null = null;

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    useActionState: (
      action: (prevState: unknown, formData: FormData) => Promise<unknown>,
      initialState: unknown
    ) => {
      const [state, setState] = (actual as typeof React).useState(initialState);
      const [isPending, setIsPending] = (actual as typeof React).useState(false);

      const formAction = async (formData: FormData) => {
        setIsPending(true);
        try {
          const result = await action(state, formData);
          setState(result);
        } finally {
          setIsPending(false);
        }
      };

      capturedFormAction = formAction;
      return [state, formAction, isPending];
    },
  };
});

import { ReportModal } from "@/components/report-modal";

describe("ReportModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedFormAction = null;
  });

  it("does not render when closed", () => {
    render(
      <ReportModal
        contentType="post"
        contentId="post-123"
        isOpen={false}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText("Report Post")).not.toBeInTheDocument();
  });

  it("renders with correct title for post", () => {
    render(
      <ReportModal
        contentType="post"
        contentId="post-123"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Report Post")).toBeInTheDocument();
  });

  it("renders with correct title for comment", () => {
    render(
      <ReportModal
        contentType="comment"
        contentId="comment-123"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Report Comment")).toBeInTheDocument();
  });

  it("renders with correct title for profile", () => {
    render(
      <ReportModal
        contentType="profile"
        contentId="user-123"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Report Profile")).toBeInTheDocument();
  });

  it("shows TOS link", () => {
    render(
      <ReportModal
        contentType="post"
        contentId="post-123"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const tosLink = screen.getByText("Terms of Service");
    expect(tosLink).toBeInTheDocument();
    expect(tosLink).toHaveAttribute("href", "/tos");
  });

  it("shows textarea for description", () => {
    render(
      <ReportModal
        contentType="post"
        contentId="post-123"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const textarea = screen.getByTestId("report-description");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute("maxLength", "2000");
    expect(textarea).toBeRequired();
  });

  it("shows submit button", () => {
    render(
      <ReportModal
        contentType="post"
        contentId="post-123"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId("report-submit-button")).toBeInTheDocument();
    expect(screen.getByTestId("report-submit-button")).toHaveTextContent("Submit Report");
  });

  it("calls onClose when cancel button is clicked", () => {
    const onClose = vi.fn();
    render(
      <ReportModal
        contentType="post"
        contentId="post-123"
        isOpen={true}
        onClose={onClose}
      />
    );

    screen.getByText("Cancel").click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows success message after successful submission", async () => {
    mockSubmitReport.mockResolvedValueOnce({
      success: true,
      message: "Thank you for your report. A human will review this and respond as soon as possible.",
    });

    render(
      <ReportModal
        contentType="post"
        contentId="post-123"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const formData = new FormData();
    formData.set("contentType", "post");
    formData.set("contentId", "post-123");
    formData.set("description", "This is bad");

    await act(async () => {
      await capturedFormAction!(formData);
    });

    expect(screen.getByTestId("report-success")).toBeInTheDocument();
    expect(screen.getByText(/human will review/)).toBeInTheDocument();
    expect(screen.getByTestId("report-close-button")).toBeInTheDocument();
  });

  it("shows error message after failed submission", async () => {
    mockSubmitReport.mockResolvedValueOnce({
      success: false,
      message: "Please describe what you are reporting.",
    });

    render(
      <ReportModal
        contentType="post"
        contentId="post-123"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const formData = new FormData();
    formData.set("contentType", "post");
    formData.set("contentId", "post-123");
    formData.set("description", "");

    await act(async () => {
      await capturedFormAction!(formData);
    });

    expect(screen.getByTestId("report-error")).toBeInTheDocument();
    expect(screen.getByText("Please describe what you are reporting.")).toBeInTheDocument();
  });

  it("calls onClose when clicking the close button after success", async () => {
    const onClose = vi.fn();
    mockSubmitReport.mockResolvedValueOnce({
      success: true,
      message: "Report submitted.",
    });

    render(
      <ReportModal
        contentType="post"
        contentId="post-123"
        isOpen={true}
        onClose={onClose}
      />
    );

    const formData = new FormData();
    formData.set("contentType", "post");
    formData.set("contentId", "post-123");
    formData.set("description", "test");

    await act(async () => {
      await capturedFormAction!(formData);
    });

    screen.getByTestId("report-close-button").click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on Escape key press", () => {
    const onClose = vi.fn();
    render(
      <ReportModal
        contentType="post"
        contentId="post-123"
        isOpen={true}
        onClose={onClose}
      />
    );

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes when clicking the overlay background", () => {
    const onClose = vi.fn();
    render(
      <ReportModal
        contentType="post"
        contentId="post-123"
        isOpen={true}
        onClose={onClose}
      />
    );

    const overlay = screen.getByTestId("report-modal-overlay");
    overlay.click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("has hidden inputs for contentType and contentId", () => {
    render(
      <ReportModal
        contentType="comment"
        contentId="comment-456"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const form = screen.getByTestId("report-submit-button").closest("form")!;
    const hiddenInputs = form.querySelectorAll('input[type="hidden"]');
    const names = Array.from(hiddenInputs).map((el) => [
      el.getAttribute("name"),
      el.getAttribute("value"),
    ]);
    expect(names).toContainEqual(["contentType", "comment"]);
    expect(names).toContainEqual(["contentId", "comment-456"]);
  });
});
