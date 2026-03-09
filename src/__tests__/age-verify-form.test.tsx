import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";

// Mock the server actions before importing the component
const mockInitiate = vi.fn();
const mockCheckStatus = vi.fn();

vi.mock("@/app/age-verify/actions", () => ({
  initiateAgeVerification: (...args: unknown[]) => mockInitiate(...args),
  checkVerificationStatus: (...args: unknown[]) => mockCheckStatus(...args),
}));

// Capture the formAction so tests can call it directly, bypassing jsdom
// form submission quirks with React 19's action prop.
let capturedFormAction: ((formData: FormData) => Promise<void>) | null = null;

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    useActionState: (
      action: (prevState: unknown, formData: FormData) => Promise<unknown>,
      initialState: unknown
    ) => {
      const [state, setState] = (actual as typeof import("react")).useState(initialState);
      const [isPending, setIsPending] = (actual as typeof import("react")).useState(false);

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

import { AgeVerifyForm } from "@/app/age-verify/age-verify-form";

// Submit the form by calling the captured formAction directly
async function submitForm(fields: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("firstName", fields.firstName ?? "Jane");
  formData.set("lastName", fields.lastName ?? "Doe");
  if (fields.email) formData.set("email", fields.email);
  if (fields.address) formData.set("address", fields.address);
  if (fields.city) formData.set("city", fields.city);
  if (fields.state) formData.set("state", fields.state);
  if (fields.zip) formData.set("zip", fields.zip);
  formData.set("country", fields.country ?? "US");

  await act(async () => {
    await capturedFormAction!(formData);
  });
}

describe("AgeVerifyForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedFormAction = null;
  });

  afterEach(() => {
    cleanup();
  });

  // ─── Form rendering ───────────────────────────────────────────

  it("renders the form with all fields including email when no existingEmail", () => {
    render(<AgeVerifyForm />);

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/street address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/state/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/zip/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/country/i)).toBeInTheDocument();
  });

  it("hides email field when existingEmail is provided", () => {
    render(<AgeVerifyForm existingEmail="user@example.com" />);

    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
  });

  it("shows email privacy notice when email field is visible", () => {
    render(<AgeVerifyForm />);

    expect(
      screen.getByText(/your email will only be used for age verification/i)
    ).toBeInTheDocument();
  });

  it("does not show email privacy notice when existingEmail is provided", () => {
    render(<AgeVerifyForm existingEmail="user@example.com" />);

    expect(
      screen.queryByText(/your email will only be used for age verification/i)
    ).not.toBeInTheDocument();
  });

  it("marks email as required when shown", () => {
    render(<AgeVerifyForm />);

    expect(screen.getByLabelText(/email address/i) as HTMLInputElement).toBeRequired();
  });

  it("renders the submit button", () => {
    render(<AgeVerifyForm />);

    const button = screen.getByRole("button", { name: /verify age/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it("defaults country to US", () => {
    render(<AgeVerifyForm />);

    const countrySelect = screen.getByLabelText(/country/i) as HTMLSelectElement;
    expect(countrySelect.value).toBe("US");
  });

  it("shows all country options", () => {
    render(<AgeVerifyForm />);

    const countrySelect = screen.getByLabelText(/country/i) as HTMLSelectElement;
    const options = countrySelect.querySelectorAll("option");
    expect(options.length).toBeGreaterThanOrEqual(10);
  });

  it("marks first name and last name as required", () => {
    render(<AgeVerifyForm />);

    expect(screen.getByLabelText(/first name/i) as HTMLInputElement).toBeRequired();
    expect(screen.getByLabelText(/last name/i) as HTMLInputElement).toBeRequired();
  });

  it("does not mark optional fields as required", () => {
    render(<AgeVerifyForm />);

    expect(screen.getByLabelText(/street address/i) as HTMLInputElement).not.toBeRequired();
    expect(screen.getByLabelText(/city/i) as HTMLInputElement).not.toBeRequired();
    expect(screen.getByLabelText(/state/i) as HTMLInputElement).not.toBeRequired();
    expect(screen.getByLabelText(/zip/i) as HTMLInputElement).not.toBeRequired();
  });

  it("shows privacy notice about address information", () => {
    render(<AgeVerifyForm />);

    expect(
      screen.getByText(/providing your full address improves/i)
    ).toBeInTheDocument();
  });

  // ─── Instant accepted ─────────────────────────────────────────

  it("shows success message on instant accepted status", async () => {
    mockInitiate.mockResolvedValueOnce({
      success: true,
      message: "Age verification successful",
      status: "accepted",
    });

    render(<AgeVerifyForm />);
    await submitForm();

    expect(screen.getByText(/age verification successful/i)).toBeInTheDocument();
  });

  it("shows link to profile on success", async () => {
    mockInitiate.mockResolvedValueOnce({
      success: true,
      message: "Age verification successful",
      status: "accepted",
    });

    render(<AgeVerifyForm />);
    await submitForm();

    const backLink = screen.getByText(/back to profile/i);
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest("a")).toHaveAttribute("href", "/profile");
  });

  it("shows info about viewing content on success", async () => {
    mockInitiate.mockResolvedValueOnce({
      success: true,
      message: "Age verification successful",
      status: "accepted",
    });

    render(<AgeVerifyForm />);
    await submitForm();

    expect(
      screen.getByText(/you can now view sensitive and graphic content/i)
    ).toBeInTheDocument();
  });

  // ─── Denied status ────────────────────────────────────────────

  it("shows denied message when verification is denied", async () => {
    mockInitiate.mockResolvedValueOnce({
      success: false,
      message: "Verification denied: underage",
      status: "denied",
    });

    render(<AgeVerifyForm />);
    await submitForm();

    expect(screen.getByText(/verification could not be completed/i)).toBeInTheDocument();
    expect(screen.getByText(/verification denied: underage/i)).toBeInTheDocument();
  });

  it("shows denied message on not_created status", async () => {
    mockInitiate.mockResolvedValueOnce({
      success: false,
      message: "You may not meet the minimum age requirement.",
      status: "not_created",
    });

    render(<AgeVerifyForm />);
    await submitForm();

    expect(screen.getByText(/verification could not be completed/i)).toBeInTheDocument();
  });

  it("allows retrying after denied", async () => {
    mockInitiate.mockResolvedValueOnce({
      success: false,
      message: "Verification denied",
      status: "denied",
    });

    render(<AgeVerifyForm />);
    await submitForm();

    expect(screen.getByText(/try again/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText(/try again/i));
    });

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
  });

  // ─── Server errors ────────────────────────────────────────────

  it("shows error message when server returns error", async () => {
    mockInitiate.mockResolvedValueOnce({
      success: false,
      message: "First and last name are required",
    });

    render(<AgeVerifyForm />);
    await submitForm();

    expect(screen.getByText(/first and last name are required/i)).toBeInTheDocument();
    // Form should still be visible
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
  });

  it("shows not authenticated error", async () => {
    mockInitiate.mockResolvedValueOnce({
      success: false,
      message: "Not authenticated",
    });

    render(<AgeVerifyForm />);
    await submitForm();

    expect(screen.getByText(/not authenticated/i)).toBeInTheDocument();
  });

  it("shows date of birth required error", async () => {
    mockInitiate.mockResolvedValueOnce({
      success: false,
      message: "Date of birth is required",
    });

    render(<AgeVerifyForm />);
    await submitForm();

    expect(screen.getByText(/date of birth is required/i)).toBeInTheDocument();
  });

  it("shows email required error", async () => {
    mockInitiate.mockResolvedValueOnce({
      success: false,
      message: "Email address is required",
    });

    render(<AgeVerifyForm />);
    await submitForm();

    expect(screen.getByText(/email address is required/i)).toBeInTheDocument();
  });

  // ─── Waiting / contact flow ─────────────────────────────────────

  it("shows waiting UI on photo_id status", async () => {
    mockInitiate.mockResolvedValueOnce({
      success: true,
      message: "Additional verification required",
      uuid: "uuid-photo-123",
      status: "photo_id",
    });

    render(<AgeVerifyForm />);
    await submitForm();

    expect(screen.getByText(/waiting for verification/i)).toBeInTheDocument();
  });

  it("shows waiting UI on signature status", async () => {
    mockInitiate.mockResolvedValueOnce({
      success: true,
      message: "Additional verification required",
      uuid: "uuid-sig-123",
      status: "signature",
    });

    render(<AgeVerifyForm />);
    await submitForm();

    expect(screen.getByText(/waiting for verification/i)).toBeInTheDocument();
  });

  it("shows waiting UI on pending status", async () => {
    mockInitiate.mockResolvedValueOnce({
      success: true,
      message: "Additional verification required",
      uuid: "uuid-pending-123",
      status: "pending",
    });

    render(<AgeVerifyForm />);
    await submitForm();

    expect(screen.getByText(/waiting for verification/i)).toBeInTheDocument();
  });

  it("shows cancel button during waiting and returns to form", async () => {
    mockInitiate.mockResolvedValueOnce({
      success: true,
      message: "Additional verification required",
      uuid: "uuid-pending-123",
      status: "pending",
    });

    render(<AgeVerifyForm />);
    await submitForm();

    expect(screen.getByText(/cancel/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText(/cancel/i));
    });

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
  });

  it("shows check email/phone message during polling", async () => {
    mockInitiate.mockResolvedValueOnce({
      success: true,
      message: "Additional verification required",
      uuid: "uuid-pending",
      status: "pending",
    });

    render(<AgeVerifyForm />);
    await submitForm();

    expect(screen.getByText(/check your email or phone/i)).toBeInTheDocument();
  });

  // ─── Form data submission ─────────────────────────────────────

  it("calls initiateAgeVerification when form is submitted", async () => {
    mockInitiate.mockResolvedValueOnce({
      success: true,
      message: "Age verification successful",
      status: "accepted",
    });

    render(<AgeVerifyForm />);
    await submitForm({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      address: "123 Main St",
      city: "New York",
      state: "NY",
      zip: "10001",
    });

    expect(mockInitiate).toHaveBeenCalledTimes(1);
  });
});

// Polling tests with fake timers
describe("AgeVerifyForm - polling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedFormAction = null;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  async function submitPolling() {
    const formData = new FormData();
    formData.set("firstName", "Jane");
    formData.set("lastName", "Doe");
    formData.set("country", "US");
    await act(async () => {
      await capturedFormAction!(formData);
    });
  }

  it("polls checkVerificationStatus and transitions to success", async () => {
    mockInitiate.mockResolvedValueOnce({
      success: true,
      message: "Additional verification required",
      uuid: "uuid-poll-123",
      status: "pending",
    });

    mockCheckStatus
      .mockResolvedValueOnce({
        success: true,
        message: "Verification is still pending",
        status: "pending",
      })
      .mockResolvedValueOnce({
        success: true,
        message: "Age verification successful",
        status: "accepted",
      });

    render(<AgeVerifyForm />);
    await submitPolling();

    expect(screen.getByText(/waiting for verification/i)).toBeInTheDocument();

    // Advance timer for first poll (3s interval)
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });

    expect(mockCheckStatus).toHaveBeenCalledTimes(1);

    // Advance timer for second poll
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });

    await waitFor(() => {
      expect(screen.getByText(/age verification successful/i)).toBeInTheDocument();
    });
  });

  it("transitions to denied state when polling returns denied", async () => {
    mockInitiate.mockResolvedValueOnce({
      success: true,
      message: "Additional verification required",
      uuid: "uuid-poll-deny",
      status: "pending",
    });

    mockCheckStatus.mockResolvedValueOnce({
      success: false,
      message: "Verification denied: fraud",
      status: "denied",
    });

    render(<AgeVerifyForm />);
    await submitPolling();

    expect(screen.getByText(/waiting for verification/i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(3100);
    });

    await waitFor(() => {
      expect(screen.getByText(/verification could not be completed/i)).toBeInTheDocument();
    });
  });

  it("continues polling when checkVerificationStatus throws", async () => {
    mockInitiate.mockResolvedValueOnce({
      success: true,
      message: "Additional verification required",
      uuid: "uuid-poll-err",
      status: "pending",
    });

    mockCheckStatus
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        success: true,
        message: "Age verification successful",
        status: "accepted",
      });

    render(<AgeVerifyForm />);
    await submitPolling();

    expect(screen.getByText(/waiting for verification/i)).toBeInTheDocument();

    // First poll fails
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });

    // Should still be in waiting state (resilient to errors)
    expect(screen.getByText(/waiting for verification/i)).toBeInTheDocument();

    // Second poll succeeds
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });

    await waitFor(() => {
      expect(screen.getByText(/age verification successful/i)).toBeInTheDocument();
    });
  });
});
