import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import React from "react";

vi.mock("@/app/report/actions", () => ({
  submitReport: vi.fn(),
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

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    useActionState: (
      _action: unknown,
      initialState: unknown
    ) => {
      return [initialState, vi.fn(), false];
    },
  };
});

import { ReportButton } from "@/components/report-button";

describe("ReportButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with default label", () => {
    render(
      <ReportButton contentType="profile" contentId="user-123" />
    );

    const button = screen.getByTestId("profile-report-button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Report");
  });

  it("renders with custom label", () => {
    render(
      <ReportButton contentType="profile" contentId="user-123" label="Report User" />
    );

    expect(screen.getByTestId("profile-report-button")).toHaveTextContent("Report User");
  });

  it("opens report modal on click", async () => {
    render(
      <ReportButton contentType="profile" contentId="user-123" />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("profile-report-button"));
    });
    expect(screen.getByText("Report Profile")).toBeInTheDocument();
  });

  it("passes correct content type and id to modal", async () => {
    render(
      <ReportButton contentType="post" contentId="post-456" />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("profile-report-button"));
    });
    expect(screen.getByText("Report Post")).toBeInTheDocument();

    const form = screen.getByTestId("report-submit-button").closest("form")!;
    const hiddenInputs = form.querySelectorAll('input[type="hidden"]');
    const names = Array.from(hiddenInputs).map((el) => [
      el.getAttribute("name"),
      el.getAttribute("value"),
    ]);
    expect(names).toContainEqual(["contentType", "post"]);
    expect(names).toContainEqual(["contentId", "post-456"]);
  });
});
