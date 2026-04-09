import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";

const mockChangePassword = vi.fn();

vi.mock("@/app/profile/actions", () => ({
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
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

import { PasswordSection } from "@/app/profile/password-section";

async function submitForm(fields: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("currentPassword", fields.currentPassword ?? "OldPass123!");
  formData.set("newPassword", fields.newPassword ?? "NewPass456!");
  formData.set("confirmNewPassword", fields.confirmNewPassword ?? "NewPass456!");

  await act(async () => {
    await capturedFormAction!(formData);
  });
}

describe("PasswordSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedFormAction = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing for non-credentials users", () => {
    const { container } = render(
      <PasswordSection isCredentialsUser={false} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the form for credentials users", () => {
    render(<PasswordSection isCredentialsUser={true} />);
    expect(screen.getByRole("button", { name: "Change Password" })).toBeInTheDocument();
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
  });

  it("password inputs have type password", () => {
    render(<PasswordSection isCredentialsUser={true} />);
    expect(screen.getByLabelText(/current password/i)).toHaveAttribute("type", "password");
    expect(screen.getByLabelText(/^new password/i)).toHaveAttribute("type", "password");
    expect(screen.getByLabelText(/confirm new password/i)).toHaveAttribute("type", "password");
  });

  it("new password inputs have minLength 8", () => {
    render(<PasswordSection isCredentialsUser={true} />);
    expect(screen.getByLabelText(/^new password/i)).toHaveAttribute("minLength", "8");
    expect(screen.getByLabelText(/confirm new password/i)).toHaveAttribute("minLength", "8");
  });

  it("shows success message after successful change", async () => {
    mockChangePassword.mockResolvedValueOnce({
      success: true,
      message: "Password changed successfully",
    });

    render(<PasswordSection isCredentialsUser={true} />);
    await submitForm();

    expect(screen.getByText("Password changed successfully")).toBeInTheDocument();
    expect(screen.getByTestId("change-password-message")).toHaveClass("text-green-600");
  });

  it("shows error message on failure", async () => {
    mockChangePassword.mockResolvedValueOnce({
      success: false,
      message: "Current password is incorrect",
    });

    render(<PasswordSection isCredentialsUser={true} />);
    await submitForm();

    expect(screen.getByText("Current password is incorrect")).toBeInTheDocument();
    expect(screen.getByTestId("change-password-message")).toHaveClass("text-red-600");
  });

  it("calls changePassword on submit", async () => {
    mockChangePassword.mockResolvedValueOnce({
      success: true,
      message: "Done",
    });

    render(<PasswordSection isCredentialsUser={true} />);
    await submitForm();

    expect(mockChangePassword).toHaveBeenCalledTimes(1);
  });
});
