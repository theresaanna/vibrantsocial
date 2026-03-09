"use client";

import { useActionState, useState, useEffect, useRef, useCallback } from "react";
import {
  initiateAgeVerification,
  checkVerificationStatus,
} from "./actions";
import type { AgeCheckerStatus } from "@/lib/agechecker";

const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" },
  { code: "AU", label: "Australia" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "NL", label: "Netherlands" },
  { code: "SE", label: "Sweden" },
  { code: "NO", label: "Norway" },
  { code: "NZ", label: "New Zealand" },
  { code: "JP", label: "Japan" },
  { code: "KR", label: "South Korea" },
  { code: "SG", label: "Singapore" },
  { code: "IE", label: "Ireland" },
  { code: "PT", label: "Portugal" },
  { code: "BR", label: "Brazil" },
  { code: "MX", label: "Mexico" },
] as const;

type Step = "form" | "polling" | "success" | "denied" | "error";

interface ActionState {
  success: boolean;
  message: string;
  uuid?: string;
  status?: AgeCheckerStatus;
}

const initialState: ActionState = {
  success: false,
  message: "",
};

interface AgeVerifyFormProps {
  existingEmail?: string;
}

export function AgeVerifyForm({ existingEmail }: AgeVerifyFormProps) {
  const [step, setStep] = useState<Step>("form");
  const [errorMessage, setErrorMessage] = useState("");
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, formAction, isPending] = useActionState(
    async (prevState: ActionState, formData: FormData): Promise<ActionState> => {
      const result = await initiateAgeVerification(prevState, formData);
      return result;
    },
    initialState
  );

  // Handle server action response
  useEffect(() => {
    if (!state.message) return;

    if (state.status === "accepted") {
      setStep("success");
      return;
    }

    if (state.status === "denied" || state.status === "not_created") {
      setStep("denied");
      setErrorMessage(state.message);
      return;
    }

    if (!state.success && !state.uuid) {
      // Server error (e.g. missing fields, not authenticated)
      setStep("form");
      setErrorMessage(state.message);
      return;
    }

    // Additional verification needed — AgeChecker will contact the user
    if (state.uuid) {
      setStep("polling");
    }
  }, [state]);

  // Poll for verification status
  const pollStatus = useCallback(async () => {
    try {
      const result = await checkVerificationStatus();

      if (result.status === "accepted") {
        setStep("success");
        return true;
      }

      if (result.status === "denied") {
        setStep("denied");
        setErrorMessage(result.message);
        return true;
      }

      // Still pending — continue polling
      return false;
    } catch {
      // Network error — continue polling
      return false;
    }
  }, []);

  useEffect(() => {
    if (step !== "polling") {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    // Poll every 3 seconds
    pollIntervalRef.current = setInterval(async () => {
      const done = await pollStatus();
      if (done && pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [step, pollStatus]);

  // Success state
  if (step === "success") {
    return (
      <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/20">
        <svg
          className="mx-auto h-10 w-10 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="mt-2 text-sm font-medium text-green-800 dark:text-green-200">
          Age verification successful!
        </p>
        <p className="mt-1 text-xs text-green-600 dark:text-green-400">
          You can now view sensitive and graphic content.
        </p>
        <a
          href="/profile"
          className="mt-3 inline-block text-sm text-green-700 hover:underline dark:text-green-300"
        >
          Back to profile
        </a>
      </div>
    );
  }

  // Denied state
  if (step === "denied") {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-center dark:bg-red-900/20">
        <svg
          className="mx-auto h-10 w-10 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="mt-2 text-sm font-medium text-red-800 dark:text-red-200">
          Verification could not be completed
        </p>
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
        <button
          type="button"
          onClick={() => {
            setStep("form");
            setErrorMessage("");
          }}
          className="mt-3 text-sm text-red-700 hover:underline dark:text-red-300"
        >
          Try again
        </button>
      </div>
    );
  }

  // Polling / waiting state
  if (step === "polling") {
    return (
      <div className="py-6 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
        <p className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Waiting for verification...
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Check your email or phone for instructions from AgeChecker.net. This
          page will update automatically once verification is complete.
        </p>
        <button
          type="button"
          onClick={() => {
            setStep("form");
            setErrorMessage("");
          }}
          className="mt-4 text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Form state (default)
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="firstName"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            First name <span className="text-red-500">*</span>
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            autoComplete="given-name"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="Jane"
          />
        </div>
        <div>
          <label
            htmlFor="lastName"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Last name <span className="text-red-500">*</span>
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            autoComplete="family-name"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="Doe"
          />
        </div>
      </div>

      {!existingEmail && (
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Email address <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="you@example.com"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Your email will only be used for age verification and to associate
            with your profile. It will not be shared or used for marketing.
          </p>
        </div>
      )}

      <div>
        <label
          htmlFor="address"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Street address
        </label>
        <input
          id="address"
          name="address"
          type="text"
          autoComplete="street-address"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="123 Main St"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="city"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            City
          </label>
          <input
            id="city"
            name="city"
            type="text"
            autoComplete="address-level2"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="New York"
          />
        </div>
        <div>
          <label
            htmlFor="state"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            State / Province
          </label>
          <input
            id="state"
            name="state"
            type="text"
            autoComplete="address-level1"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="NY"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="zip"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            ZIP / Postal code
          </label>
          <input
            id="zip"
            name="zip"
            type="text"
            autoComplete="postal-code"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="10001"
          />
        </div>
        <div>
          <label
            htmlFor="country"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Country
          </label>
          <select
            id="country"
            name="country"
            defaultValue="US"
            autoComplete="country"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Providing your full address improves the chance of instant verification.
        Your information is transmitted securely and used only for age
        verification purposes.
      </p>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Verifying..." : "Verify Age"}
      </button>

      {errorMessage && (
        <p className="text-center text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
