"use client";

import { useActionState, useState } from "react";
import { sendPhoneCode, verifyPhoneCode } from "./actions";
import type { VerifyState } from "./actions";

const COUNTRY_CODES = [
  { code: "+1", label: "US/CA", flag: "\u{1F1FA}\u{1F1F8}" },
  { code: "+44", label: "UK", flag: "\u{1F1EC}\u{1F1E7}" },
  { code: "+61", label: "AU", flag: "\u{1F1E6}\u{1F1FA}" },
  { code: "+33", label: "FR", flag: "\u{1F1EB}\u{1F1F7}" },
  { code: "+49", label: "DE", flag: "\u{1F1E9}\u{1F1EA}" },
  { code: "+81", label: "JP", flag: "\u{1F1EF}\u{1F1F5}" },
  { code: "+82", label: "KR", flag: "\u{1F1F0}\u{1F1F7}" },
  { code: "+86", label: "CN", flag: "\u{1F1E8}\u{1F1F3}" },
  { code: "+91", label: "IN", flag: "\u{1F1EE}\u{1F1F3}" },
  { code: "+52", label: "MX", flag: "\u{1F1F2}\u{1F1FD}" },
  { code: "+55", label: "BR", flag: "\u{1F1E7}\u{1F1F7}" },
  { code: "+34", label: "ES", flag: "\u{1F1EA}\u{1F1F8}" },
  { code: "+39", label: "IT", flag: "\u{1F1EE}\u{1F1F9}" },
  { code: "+31", label: "NL", flag: "\u{1F1F3}\u{1F1F1}" },
  { code: "+46", label: "SE", flag: "\u{1F1F8}\u{1F1EA}" },
  { code: "+47", label: "NO", flag: "\u{1F1F3}\u{1F1F4}" },
  { code: "+64", label: "NZ", flag: "\u{1F1F3}\u{1F1FF}" },
  { code: "+65", label: "SG", flag: "\u{1F1F8}\u{1F1EC}" },
  { code: "+353", label: "IE", flag: "\u{1F1EE}\u{1F1EA}" },
  { code: "+351", label: "PT", flag: "\u{1F1F5}\u{1F1F9}" },
] as const;

const initialState: VerifyState = {
  step: "input",
  message: "",
  success: false,
};

export function VerifyPhoneForm() {
  const [countryCode, setCountryCode] = useState("+1");
  const [sendState, sendAction, isSending] = useActionState(
    sendPhoneCode,
    initialState
  );
  const [verifyState, verifyAction, isVerifying] = useActionState(
    verifyPhoneCode,
    initialState
  );

  const currentStep = sendState.step === "verify" ? "verify" : "input";
  const isDone = verifyState.step === "done";

  if (isDone) {
    return (
      <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/20">
        <p className="text-sm font-medium text-green-800 dark:text-green-200">
          Phone number verified successfully!
        </p>
        <a
          href="/profile"
          className="mt-2 inline-block text-sm text-green-700 hover:underline dark:text-green-300"
        >
          Back to profile
        </a>
      </div>
    );
  }

  if (currentStep === "verify") {
    return (
      <form action={verifyAction} className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          We sent a code to your phone. Enter it below.
        </p>

        <div>
          <label
            htmlFor="code"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Verification Code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            required
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-lg tracking-widest dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="123456"
            autoComplete="one-time-code"
          />
        </div>

        <button
          type="submit"
          disabled={isVerifying}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isVerifying ? "Verifying..." : "Verify Code"}
        </button>

        {verifyState.message && !verifyState.success && (
          <p className="text-sm text-red-600">{verifyState.message}</p>
        )}
      </form>
    );
  }

  return (
    <form action={sendAction} className="space-y-4">
      <div>
        <label
          htmlFor="localNumber"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Phone Number
        </label>
        <div className="mt-1 flex gap-2">
          <select
            name="countryCode"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="w-32 shrink-0 rounded-lg border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            aria-label="Country code"
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.code} {c.label}
              </option>
            ))}
          </select>
          <input
            id="localNumber"
            name="localNumber"
            type="tel"
            required
            inputMode="numeric"
            className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="2125551234"
          />
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Your phone number will not be displayed on your profile or sold to
          third parties. We collect it to help prevent spam and abuse accounts.
        </p>
      </div>

      <button
        type="submit"
        disabled={isSending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isSending ? "Sending code..." : "Send Verification Code"}
      </button>

      {sendState.message && !sendState.success && (
        <p className="text-sm text-red-600">{sendState.message}</p>
      )}
    </form>
  );
}
