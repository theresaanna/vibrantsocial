"use client";

import { useActionState } from "react";
import { sendPhoneCode, verifyPhoneCode } from "./actions";
import type { VerifyState } from "./actions";

const initialState: VerifyState = {
  step: "input",
  message: "",
  success: false,
};

export function VerifyPhoneForm() {
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
          htmlFor="phoneNumber"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Phone Number
        </label>
        <input
          id="phoneNumber"
          name="phoneNumber"
          type="tel"
          required
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="+12125551234"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Include country code (e.g., +1 for US)
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
