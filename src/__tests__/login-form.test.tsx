import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";

const mockLoginWithCredentials = vi.fn();

vi.mock("@/app/login/actions", () => ({
  loginWithCredentials: (...args: unknown[]) =>
    mockLoginWithCredentials(...args),
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

import { LoginForm } from "@/app/login/login-form";

async function submitForm(fields: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("email", fields.email ?? "test@example.com");
  formData.set("password", fields.password ?? "password123");

  await act(async () => {
    await capturedFormAction!(formData);
  });
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedFormAction = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders email input", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("renders password input", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("renders sign in button", () => {
    render(<LoginForm />);
    expect(
      screen.getByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it("renders forgot password link", () => {
    render(<LoginForm />);
    const link = screen.getByRole("link", { name: /forgot password/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/forgot-password");
  });

  it("email input is required", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeRequired();
  });

  it("password input is required", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/password/i)).toBeRequired();
  });

  it("email input has type email", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("type", "email");
  });

  it("password input has type password", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/password/i)).toHaveAttribute(
      "type",
      "password"
    );
  });

  it("displays error message from server action", async () => {
    mockLoginWithCredentials.mockResolvedValueOnce({
      success: false,
      message: "Invalid email or password",
    });

    render(<LoginForm />);
    await submitForm();

    expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
  });

  it("does not display message when empty", () => {
    render(<LoginForm />);
    expect(
      screen.queryByText("Invalid email or password")
    ).not.toBeInTheDocument();
  });

  it("calls loginWithCredentials on submit", async () => {
    mockLoginWithCredentials.mockResolvedValueOnce({
      success: true,
      message: "",
    });

    render(<LoginForm />);
    await submitForm({ email: "user@test.com", password: "mypassword" });

    expect(mockLoginWithCredentials).toHaveBeenCalledTimes(1);
  });
});
