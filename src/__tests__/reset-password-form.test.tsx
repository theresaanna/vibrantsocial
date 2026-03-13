import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";

const mockResetPassword = vi.fn();

vi.mock("@/app/reset-password/actions", () => ({
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
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

import { ResetPasswordForm } from "@/app/reset-password/reset-password-form";

async function submitForm(fields: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("token", fields.token ?? "test-token");
  formData.set("email", fields.email ?? "test@example.com");
  formData.set("password", fields.password ?? "newpassword123");
  formData.set(
    "confirmPassword",
    fields.confirmPassword ?? "newpassword123"
  );

  await act(async () => {
    await capturedFormAction!(formData);
  });
}

describe("ResetPasswordForm", () => {
  const defaultProps = {
    token: "test-token-123",
    email: "test@example.com",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedFormAction = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders new password input", () => {
    render(<ResetPasswordForm {...defaultProps} />);
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
  });

  it("renders confirm new password input", () => {
    render(<ResetPasswordForm {...defaultProps} />);
    expect(screen.getByLabelText(/^confirm new password$/i)).toBeInTheDocument();
  });

  it("renders reset password button", () => {
    render(<ResetPasswordForm {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: /reset password/i })
    ).toBeInTheDocument();
  });

  it("password inputs are required", () => {
    render(<ResetPasswordForm {...defaultProps} />);
    expect(screen.getByLabelText(/^new password/i)).toBeRequired();
    expect(screen.getByLabelText(/confirm new password/i)).toBeRequired();
  });

  it("password inputs have type password", () => {
    render(<ResetPasswordForm {...defaultProps} />);
    expect(screen.getByLabelText(/^new password/i)).toHaveAttribute(
      "type",
      "password"
    );
    expect(screen.getByLabelText(/confirm new password/i)).toHaveAttribute(
      "type",
      "password"
    );
  });

  it("password inputs have minLength 8", () => {
    render(<ResetPasswordForm {...defaultProps} />);
    expect(screen.getByLabelText(/^new password/i)).toHaveAttribute(
      "minLength",
      "8"
    );
    expect(screen.getByLabelText(/confirm new password/i)).toHaveAttribute(
      "minLength",
      "8"
    );
  });

  it("includes hidden token and email fields", () => {
    const { container } = render(<ResetPasswordForm {...defaultProps} />);
    const tokenInput = container.querySelector(
      'input[name="token"]'
    ) as HTMLInputElement;
    const emailInput = container.querySelector(
      'input[name="email"]'
    ) as HTMLInputElement;

    expect(tokenInput).toBeInTheDocument();
    expect(tokenInput.type).toBe("hidden");
    expect(tokenInput.value).toBe("test-token-123");

    expect(emailInput).toBeInTheDocument();
    expect(emailInput.type).toBe("hidden");
    expect(emailInput.value).toBe("test@example.com");
  });

  it("shows success message and sign in link on success", async () => {
    mockResetPassword.mockResolvedValueOnce({
      success: true,
      message: "Your password has been reset successfully.",
    });

    render(<ResetPasswordForm {...defaultProps} />);
    await submitForm();

    expect(
      screen.getByText("Your password has been reset successfully.")
    ).toBeInTheDocument();
    const signInLink = screen.getByRole("link", { name: /go to sign in/i });
    expect(signInLink).toHaveAttribute("href", "/login");
  });

  it("shows error message on failure", async () => {
    mockResetPassword.mockResolvedValueOnce({
      success: false,
      message: "Passwords do not match",
    });

    render(<ResetPasswordForm {...defaultProps} />);
    await submitForm();

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
  });

  it("does not show form after success", async () => {
    mockResetPassword.mockResolvedValueOnce({
      success: true,
      message: "Password reset!",
    });

    render(<ResetPasswordForm {...defaultProps} />);
    await submitForm();

    expect(screen.queryByLabelText(/^new password/i)).not.toBeInTheDocument();
  });

  it("keeps form visible after error", async () => {
    mockResetPassword.mockResolvedValueOnce({
      success: false,
      message: "Token expired",
    });

    render(<ResetPasswordForm {...defaultProps} />);
    await submitForm();

    expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reset password/i })
    ).toBeInTheDocument();
  });

  it("calls resetPassword on submit", async () => {
    mockResetPassword.mockResolvedValueOnce({
      success: true,
      message: "Done",
    });

    render(<ResetPasswordForm {...defaultProps} />);
    await submitForm();

    expect(mockResetPassword).toHaveBeenCalledTimes(1);
  });
});
