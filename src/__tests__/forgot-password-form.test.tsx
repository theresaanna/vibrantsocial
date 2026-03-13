import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";

const mockRequestPasswordReset = vi.fn();

vi.mock("@/app/forgot-password/actions", () => ({
  requestPasswordReset: (...args: unknown[]) =>
    mockRequestPasswordReset(...args),
}));

// Capture the formAction so tests can call it directly
let capturedFormAction: ((formData: FormData) => Promise<void>) | null = null;

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    useActionState: (
      action: (prevState: unknown, formData: FormData) => Promise<unknown>,
      initialState: unknown
    ) => {
      const [state, setState] = (actual as typeof import("react")).useState(
        initialState
      );
      const [isPending, setIsPending] = (
        actual as typeof import("react")
      ).useState(false);

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

import { ForgotPasswordForm } from "@/app/forgot-password/forgot-password-form";

async function submitForm(fields: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("email", fields.email ?? "test@example.com");

  await act(async () => {
    await capturedFormAction!(formData);
  });
}

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedFormAction = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders email input", () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("renders send reset link button", () => {
    render(<ForgotPasswordForm />);
    expect(
      screen.getByRole("button", { name: /send reset link/i })
    ).toBeInTheDocument();
  });

  it("email input is required", () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/email/i)).toBeRequired();
  });

  it("email input has type email", () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("type", "email");
  });

  it("email input has placeholder", () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/email/i)).toHaveAttribute(
      "placeholder",
      "you@example.com"
    );
  });

  it("does not show any message initially", () => {
    render(<ForgotPasswordForm />);
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
  });

  it("displays success message with green styling", async () => {
    mockRequestPasswordReset.mockResolvedValueOnce({
      success: true,
      message: "Check your email for a reset link",
    });

    render(<ForgotPasswordForm />);
    await submitForm();

    const message = screen.getByText("Check your email for a reset link");
    expect(message).toBeInTheDocument();
    expect(message).toHaveClass("text-green-600");
  });

  it("displays error message with red styling", async () => {
    mockRequestPasswordReset.mockResolvedValueOnce({
      success: false,
      message: "Email not found",
    });

    render(<ForgotPasswordForm />);
    await submitForm();

    const message = screen.getByText("Email not found");
    expect(message).toBeInTheDocument();
    expect(message).toHaveClass("text-red-600");
  });

  it("calls requestPasswordReset on submit", async () => {
    mockRequestPasswordReset.mockResolvedValueOnce({
      success: true,
      message: "Reset link sent",
    });

    render(<ForgotPasswordForm />);
    await submitForm({ email: "user@test.com" });

    expect(mockRequestPasswordReset).toHaveBeenCalledTimes(1);
  });
});
