"use client";

import { useState, useRef, useEffect } from "react";
import {
  verifyTwoFactorLogin,
  verifyBackupCodeLogin,
  verifyPasskeyLogin,
  getPasskeyAuthenticationOptions,
  hasPasskeysForPending,
} from "./actions";
import { startAuthentication } from "@simplewebauthn/browser";

type Mode = "totp" | "backup" | "passkey";

interface TwoFactorFormProps {
  pendingToken: string;
}

export function TwoFactorForm({ pendingToken }: TwoFactorFormProps) {
  const [mode, setMode] = useState<Mode>("totp");
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPasskeys, setHasPasskeys] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hasPasskeysForPending(pendingToken).then(setHasPasskeys);
  }, [pendingToken]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  async function handleTOTPSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const result = await verifyTwoFactorLogin(pendingToken, code);
      if (!result.success) {
        setError(result.message);
      }
    } catch {
      // NEXT_REDIRECT throws — this is expected on success
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBackupSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const result = await verifyBackupCodeLogin(pendingToken, backupCode);
      if (!result.success) {
        setError(result.message);
      }
    } catch {
      // NEXT_REDIRECT throws — this is expected on success
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePasskeyAuth() {
    setIsLoading(true);
    setError(null);
    try {
      const optionsResult = await getPasskeyAuthenticationOptions(pendingToken);
      if (!optionsResult.success || !optionsResult.options) {
        setError(optionsResult.message);
        return;
      }

      const authResponse = await startAuthentication({ optionsJSON: optionsResult.options });
      const result = await verifyPasskeyLogin(pendingToken, authResponse);
      if (!result.success) {
        setError(result.message);
      }
    } catch {
      setError("Passkey authentication failed or was cancelled.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {mode === "totp" && (
        <form onSubmit={handleTOTPSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="totp-code"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Authentication Code
            </label>
            <input
              ref={inputRef}
              id="totp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-lg tracking-widest dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="000000"
              data-testid="totp-input"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || code.length !== 6}
            className="w-full rounded-lg bg-gradient-to-r from-fuchsia-600 to-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:from-fuchsia-500 hover:to-blue-500 disabled:opacity-50"
            data-testid="totp-submit"
          >
            {isLoading ? "Verifying..." : "Verify"}
          </button>
        </form>
      )}

      {mode === "backup" && (
        <form onSubmit={handleBackupSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="backup-code"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Backup Code
            </label>
            <input
              ref={inputRef}
              id="backup-code"
              type="text"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-lg tracking-widest dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="xxxx-xxxx"
              data-testid="backup-code-input"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !backupCode.trim()}
            className="w-full rounded-lg bg-gradient-to-r from-fuchsia-600 to-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:from-fuchsia-500 hover:to-blue-500 disabled:opacity-50"
            data-testid="backup-code-submit"
          >
            {isLoading ? "Verifying..." : "Verify Backup Code"}
          </button>
        </form>
      )}

      {mode === "passkey" && (
        <div className="space-y-4">
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            Use your passkey to verify your identity.
          </p>
          <button
            type="button"
            onClick={handlePasskeyAuth}
            disabled={isLoading}
            className="w-full rounded-lg bg-gradient-to-r from-fuchsia-600 to-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:from-fuchsia-500 hover:to-blue-500 disabled:opacity-50"
            data-testid="passkey-auth-button"
          >
            {isLoading ? "Authenticating..." : "Use Passkey"}
          </button>
        </div>
      )}

      {error && (
        <p className="text-center text-sm text-red-600" data-testid="2fa-error">
          {error}
        </p>
      )}

      {/* Mode switchers */}
      <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
        {mode !== "totp" && (
          <button
            type="button"
            onClick={() => { setMode("totp"); setError(null); }}
            className="block w-full text-center text-sm text-fuchsia-600 hover:underline dark:text-fuchsia-400"
            data-testid="switch-to-totp"
          >
            Use authenticator app
          </button>
        )}
        {mode !== "passkey" && hasPasskeys && (
          <button
            type="button"
            onClick={() => { setMode("passkey"); setError(null); }}
            className="block w-full text-center text-sm text-fuchsia-600 hover:underline dark:text-fuchsia-400"
            data-testid="switch-to-passkey"
          >
            Use passkey
          </button>
        )}
        {mode !== "backup" && (
          <button
            type="button"
            onClick={() => { setMode("backup"); setError(null); }}
            className="block w-full text-center text-sm text-fuchsia-600 hover:underline dark:text-fuchsia-400"
            data-testid="switch-to-backup"
          >
            Use a backup code
          </button>
        )}
        <a
          href="/login"
          className="block text-center text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          Back to login
        </a>
      </div>
    </div>
  );
}
