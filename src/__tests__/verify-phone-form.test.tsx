import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSendPhoneCode = vi.fn();
const mockVerifyPhoneCode = vi.fn();

vi.mock("@/app/verify-phone/actions", () => ({
  sendPhoneCode: (...args: unknown[]) => mockSendPhoneCode(...args),
  verifyPhoneCode: (...args: unknown[]) => mockVerifyPhoneCode(...args),
}));

// Track multiple formActions: the component uses two useActionState calls
const capturedFormActions: Array<
  ((formData: FormData) => Promise<void>) | null
> = [null, null];
let actionIndex = 0;

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

      // Capture the first two actions (sendPhoneCode, verifyPhoneCode)
      const idx = actionIndex++;
      if (idx < capturedFormActions.length) {
        capturedFormActions[idx] = formAction;
      }

      return [state, formAction, isPending];
    },
  };
});

import { VerifyPhoneForm } from "@/app/verify-phone/verify-phone-form";

describe("VerifyPhoneForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedFormActions[0] = null;
    capturedFormActions[1] = null;
    actionIndex = 0;
  });

  afterEach(() => {
    cleanup();
  });

  // ─── Input step rendering ──────────────────────────────────────

  it("renders phone number input", () => {
    render(<VerifyPhoneForm />);
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
  });

  it("renders country code select", () => {
    render(<VerifyPhoneForm />);
    expect(screen.getByLabelText(/country code/i)).toBeInTheDocument();
  });

  it("renders send verification code button", () => {
    render(<VerifyPhoneForm />);
    expect(
      screen.getByRole("button", { name: /send verification code/i })
    ).toBeInTheDocument();
  });

  it("phone input is required", () => {
    render(<VerifyPhoneForm />);
    expect(screen.getByLabelText(/phone number/i)).toBeRequired();
  });

  it("phone input has type tel", () => {
    render(<VerifyPhoneForm />);
    expect(screen.getByLabelText(/phone number/i)).toHaveAttribute(
      "type",
      "tel"
    );
  });

  it("shows privacy notice about phone number", () => {
    render(<VerifyPhoneForm />);
    expect(
      screen.getByText(/your phone number will not be displayed/i)
    ).toBeInTheDocument();
  });

  it("defaults country code to +1", () => {
    render(<VerifyPhoneForm />);
    const select = screen.getByLabelText(/country code/i) as HTMLSelectElement;
    expect(select.value).toBe("+1");
  });

  it("allows changing country code", async () => {
    const user = userEvent.setup();
    render(<VerifyPhoneForm />);
    const select = screen.getByLabelText(/country code/i);
    await user.selectOptions(select, "+44");
    expect((select as HTMLSelectElement).value).toBe("+44");
  });

  // ─── Send code error ──────────────────────────────────────────

  it("shows error from send code action", async () => {
    mockSendPhoneCode.mockResolvedValueOnce({
      step: "input",
      message: "Invalid phone number",
      success: false,
    });

    render(<VerifyPhoneForm />);

    const formData = new FormData();
    formData.set("countryCode", "+1");
    formData.set("localNumber", "123");

    await act(async () => {
      await capturedFormActions[0]!(formData);
    });

    expect(screen.getByText("Invalid phone number")).toBeInTheDocument();
  });

  // ─── Verify step ──────────────────────────────────────────────

  it("shows verify code form after send succeeds", async () => {
    mockSendPhoneCode.mockResolvedValueOnce({
      step: "verify",
      message: "",
      success: true,
    });

    render(<VerifyPhoneForm />);

    const formData = new FormData();
    formData.set("countryCode", "+1");
    formData.set("localNumber", "2125551234");

    await act(async () => {
      await capturedFormActions[0]!(formData);
    });

    expect(
      screen.getByText(/we sent a code to your phone/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /verify code/i })
    ).toBeInTheDocument();
  });

  it("shows verify error message", async () => {
    mockSendPhoneCode.mockResolvedValueOnce({
      step: "verify",
      message: "",
      success: true,
    });

    render(<VerifyPhoneForm />);

    // First, transition to verify step
    const sendFormData = new FormData();
    sendFormData.set("countryCode", "+1");
    sendFormData.set("localNumber", "2125551234");

    await act(async () => {
      await capturedFormActions[0]!(sendFormData);
    });

    // Now trigger verify error
    mockVerifyPhoneCode.mockResolvedValueOnce({
      step: "verify",
      message: "Invalid code",
      success: false,
    });

    const verifyFormData = new FormData();
    verifyFormData.set("code", "000000");

    await act(async () => {
      await capturedFormActions[1]!(verifyFormData);
    });

    expect(screen.getByText("Invalid code")).toBeInTheDocument();
  });

  // ─── Done step ────────────────────────────────────────────────

  it("shows success message after verification", async () => {
    mockSendPhoneCode.mockResolvedValueOnce({
      step: "verify",
      message: "",
      success: true,
    });

    render(<VerifyPhoneForm />);

    const sendFormData = new FormData();
    sendFormData.set("countryCode", "+1");
    sendFormData.set("localNumber", "2125551234");

    await act(async () => {
      await capturedFormActions[0]!(sendFormData);
    });

    mockVerifyPhoneCode.mockResolvedValueOnce({
      step: "done",
      message: "Phone number verified successfully!",
      success: true,
    });

    const verifyFormData = new FormData();
    verifyFormData.set("code", "123456");

    await act(async () => {
      await capturedFormActions[1]!(verifyFormData);
    });

    expect(
      screen.getByText(/phone number verified successfully/i)
    ).toBeInTheDocument();
  });

  it("shows link to profile after done", async () => {
    mockSendPhoneCode.mockResolvedValueOnce({
      step: "verify",
      message: "",
      success: true,
    });

    render(<VerifyPhoneForm />);

    const sendFormData = new FormData();
    sendFormData.set("countryCode", "+1");
    sendFormData.set("localNumber", "2125551234");

    await act(async () => {
      await capturedFormActions[0]!(sendFormData);
    });

    mockVerifyPhoneCode.mockResolvedValueOnce({
      step: "done",
      message: "",
      success: true,
    });

    const verifyFormData = new FormData();
    verifyFormData.set("code", "123456");

    await act(async () => {
      await capturedFormActions[1]!(verifyFormData);
    });

    const profileLink = screen.getByText(/back to profile/i);
    expect(profileLink).toBeInTheDocument();
    expect(profileLink.closest("a")).toHaveAttribute("href", "/profile");
  });
});
