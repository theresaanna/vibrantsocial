import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompleteProfileForm } from "@/app/complete-profile/complete-profile-form";

// Mock the server action
vi.mock("@/app/complete-profile/actions", () => ({
  completeProfile: vi.fn(),
}));

describe("CompleteProfileForm", () => {
  it("renders username field when needsUsername is true", () => {
    render(
      <CompleteProfileForm
        needsUsername={true}
        needsEmail={false}
        needsDateOfBirth={false}
      />
    );
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
  });

  it("does not render username field when needsUsername is false", () => {
    render(
      <CompleteProfileForm
        needsUsername={false}
        needsEmail={false}
        needsDateOfBirth={false}
      />
    );
    expect(screen.queryByLabelText(/username/i)).not.toBeInTheDocument();
  });

  it("renders email field when needsEmail is true", () => {
    render(
      <CompleteProfileForm
        needsUsername={false}
        needsEmail={true}
        needsDateOfBirth={false}
      />
    );
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("does not render email field when needsEmail is false", () => {
    render(
      <CompleteProfileForm
        needsUsername={false}
        needsEmail={false}
        needsDateOfBirth={false}
      />
    );
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it("renders dateOfBirth field when needsDateOfBirth is true", () => {
    render(
      <CompleteProfileForm
        needsUsername={false}
        needsEmail={false}
        needsDateOfBirth={true}
      />
    );
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
  });

  it("does not render dateOfBirth field when needsDateOfBirth is false", () => {
    render(
      <CompleteProfileForm
        needsUsername={false}
        needsEmail={false}
        needsDateOfBirth={false}
      />
    );
    expect(screen.queryByLabelText(/date of birth/i)).not.toBeInTheDocument();
  });

  it("renders all fields when all are needed", () => {
    render(
      <CompleteProfileForm
        needsUsername={true}
        needsEmail={true}
        needsDateOfBirth={true}
      />
    );
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
  });

  it("renders Continue button", () => {
    render(
      <CompleteProfileForm
        needsUsername={false}
        needsEmail={false}
        needsDateOfBirth={false}
      />
    );
    expect(
      screen.getByRole("button", { name: /continue/i })
    ).toBeInTheDocument();
  });

  it("username field has required attribute when shown", () => {
    render(
      <CompleteProfileForm
        needsUsername={true}
        needsEmail={false}
        needsDateOfBirth={false}
      />
    );
    expect(screen.getByLabelText(/username/i)).toBeRequired();
  });
});
