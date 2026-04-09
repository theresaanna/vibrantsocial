"use client";

import { useState, useEffect, useRef } from "react";
import {
  beginTOTPSetup,
  confirmTOTPSetup,
  disableTwoFactor,
  regenerateBackupCodes,
} from "./two-factor-actions";
import {
  generatePasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  listPasskeys,
  removePasskey,
  renamePasskey,
  type PasskeyInfo,
} from "./passkey-actions";
import { startRegistration } from "@simplewebauthn/browser";

interface TwoFactorSectionProps {
  twoFactorEnabled: boolean;
  isCredentialsUser: boolean;
}

export function TwoFactorSection({
  twoFactorEnabled: initialEnabled,
  isCredentialsUser,
}: TwoFactorSectionProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [step, setStep] = useState<"idle" | "setup" | "verify" | "backup-codes" | "disable">("idle");
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [passkeyName, setPasskeyName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [copiedCodes, setCopiedCodes] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (enabled) {
      listPasskeys().then(setPasskeys);
    }
  }, [enabled]);

  if (!isCredentialsUser) return null;

  async function handleBeginSetup() {
    setIsLoading(true);
    setMessage(null);
    const result = await beginTOTPSetup();
    setIsLoading(false);
    if (result.success && result.secret && result.uri) {
      setSecret(result.secret);
      setUri(result.uri);
      setStep("setup");
    } else {
      setMessage({ text: result.message, success: false });
    }
  }

  async function handleVerifyCode() {
    setIsLoading(true);
    setMessage(null);
    const result = await confirmTOTPSetup(code);
    setIsLoading(false);
    if (result.success && result.backupCodes) {
      setBackupCodes(result.backupCodes);
      setEnabled(true);
      setStep("backup-codes");
    } else {
      setMessage({ text: result.message, success: false });
    }
  }

  async function handleDisable() {
    setIsLoading(true);
    setMessage(null);
    const result = await disableTwoFactor(password);
    setIsLoading(false);
    if (result.success) {
      setEnabled(false);
      setStep("idle");
      setPassword("");
      setPasskeys([]);
      setMessage({ text: result.message, success: true });
    } else {
      setMessage({ text: result.message, success: false });
    }
  }

  async function handleRegenerateBackupCodes() {
    setIsLoading(true);
    setMessage(null);
    const result = await regenerateBackupCodes(password);
    setIsLoading(false);
    if (result.success && result.backupCodes) {
      setBackupCodes(result.backupCodes);
      setPassword("");
      setStep("backup-codes");
    } else {
      setMessage({ text: result.message, success: false });
    }
  }

  async function handleAddPasskey() {
    setIsLoading(true);
    setMessage(null);
    try {
      const optResult = await generatePasskeyRegistrationOptions();
      if (!optResult.success || !optResult.options) {
        setMessage({ text: optResult.message, success: false });
        return;
      }

      const regResponse = await startRegistration({ optionsJSON: optResult.options });
      const verifyResult = await verifyPasskeyRegistration(regResponse, passkeyName);
      if (verifyResult.success) {
        setPasskeyName("");
        const updated = await listPasskeys();
        setPasskeys(updated);
        setMessage({ text: "Passkey added!", success: true });
      } else {
        setMessage({ text: verifyResult.message, success: false });
      }
    } catch {
      setMessage({ text: "Passkey registration was cancelled or failed.", success: false });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRemovePasskey(id: string) {
    const result = await removePasskey(id);
    if (result.success) {
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
    }
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return;
    const result = await renamePasskey(id, renameValue);
    if (result.success) {
      setPasskeys((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: renameValue.trim() } : p))
      );
      setRenamingId(null);
      setRenameValue("");
    }
  }

  async function copyBackupCodes() {
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700" data-testid="two-factor-section">
      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Two-Factor Authentication
      </p>

      {/* Status */}
      <div className="mt-1 flex items-center gap-2">
        {enabled ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Enabled
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
            Not enabled
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Add extra security with an authenticator app or passkey.
      </p>

      {/* IDLE: Show enable/disable buttons */}
      {step === "idle" && !enabled && (
        <button
          type="button"
          onClick={handleBeginSetup}
          disabled={isLoading}
          className="mt-3 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          data-testid="enable-2fa-button"
        >
          {isLoading ? "Setting up..." : "Set Up Two-Factor"}
        </button>
      )}

      {step === "idle" && enabled && (
        <div className="mt-3 space-y-3">
          {/* Passkeys management */}
          <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Passkeys</p>
            {passkeys.length > 0 ? (
              <ul className="mt-2 space-y-2" data-testid="passkey-list">
                {passkeys.map((pk) => (
                  <li key={pk.id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                    <div>
                      {renamingId === pk.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="w-32 rounded border px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-700"
                            data-testid="passkey-rename-input"
                          />
                          <button
                            type="button"
                            onClick={() => handleRename(pk.id)}
                            className="text-xs text-fuchsia-600 hover:underline"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingId(null)}
                            className="text-xs text-zinc-500 hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            {pk.name || "Unnamed passkey"}
                          </span>
                          <span className="ml-2 text-xs text-zinc-400">
                            {pk.deviceType === "multiDevice" ? "Synced" : "Device-bound"}
                          </span>
                        </>
                      )}
                      <p className="text-xs text-zinc-400">
                        Added {new Date(pk.createdAt).toLocaleDateString()}
                        {pk.lastUsedAt && ` \u00B7 Last used ${new Date(pk.lastUsedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {renamingId !== pk.id && (
                        <button
                          type="button"
                          onClick={() => { setRenamingId(pk.id); setRenameValue(pk.name ?? ""); }}
                          className="text-xs text-zinc-500 hover:underline"
                          data-testid="passkey-rename-button"
                        >
                          Rename
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemovePasskey(pk.id)}
                        className="text-xs text-red-500 hover:underline"
                        data-testid="passkey-remove-button"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-zinc-400">No passkeys registered.</p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
                placeholder="Passkey name (optional)"
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                data-testid="passkey-name-input"
              />
              <button
                type="button"
                onClick={handleAddPasskey}
                disabled={isLoading}
                className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                data-testid="add-passkey-button"
              >
                Add Passkey
              </button>
            </div>
          </div>

          {/* Backup codes + disable */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setStep("disable"); setPassword(""); setMessage(null); }}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              data-testid="show-regenerate-backup"
            >
              Regenerate Backup Codes
            </button>
            <button
              type="button"
              onClick={() => { setStep("disable"); setPassword(""); setMessage(null); }}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              data-testid="disable-2fa-button"
            >
              Disable 2FA
            </button>
          </div>
        </div>
      )}

      {/* SETUP: Show QR code + secret */}
      {step === "setup" && uri && secret && (
        <div className="mt-3 space-y-4">
          <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
            <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Scan this QR code with your authenticator app:
            </p>
            {/* Render QR code as an image using a data URI from a Google Charts-style API
                Since we don't want external deps, we show the manual entry key */}
            <div className="flex items-center justify-center rounded-lg bg-white p-4 dark:bg-zinc-900">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`}
                alt="2FA QR Code"
                width={200}
                height={200}
                className="rounded"
                data-testid="totp-qr-code"
              />
            </div>
            <div className="mt-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Or enter this key manually:
              </p>
              <code
                className="mt-1 block break-all rounded bg-zinc-100 px-2 py-1 text-xs font-mono text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200"
                data-testid="totp-secret-display"
              >
                {secret}
              </code>
            </div>
          </div>

          <div>
            <label
              htmlFor="verify-code"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Enter the 6-digit code from your app:
            </label>
            <input
              ref={codeInputRef}
              id="verify-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-lg tracking-widest dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="000000"
              data-testid="setup-totp-input"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleVerifyCode}
              disabled={isLoading || code.length !== 6}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              data-testid="verify-totp-button"
            >
              {isLoading ? "Verifying..." : "Verify & Enable"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("idle"); setCode(""); setMessage(null); }}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* BACKUP CODES: Show after enabling 2FA */}
      {step === "backup-codes" && backupCodes.length > 0 && (
        <div className="mt-3 space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Save your backup codes
            </p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              Store these codes in a safe place. Each code can only be used once. If you lose access to your authenticator app, you can use one of these codes to sign in.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-1" data-testid="backup-codes-list">
              {backupCodes.map((c, i) => (
                <code
                  key={i}
                  className="rounded bg-white px-2 py-1 text-center text-xs font-mono text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {c}
                </code>
              ))}
            </div>
            <button
              type="button"
              onClick={copyBackupCodes}
              className="mt-3 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/40"
              data-testid="copy-backup-codes"
            >
              {copiedCodes ? "Copied!" : "Copy All Codes"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => { setStep("idle"); setBackupCodes([]); setCode(""); }}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            data-testid="done-backup-codes"
          >
            Done
          </button>
        </div>
      )}

      {/* DISABLE: Password confirmation */}
      {step === "disable" && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Enter your password to continue.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            data-testid="2fa-password-input"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDisable}
              disabled={isLoading || !password}
              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              data-testid="confirm-disable-2fa"
            >
              {isLoading ? "Disabling..." : "Disable 2FA"}
            </button>
            <button
              type="button"
              onClick={handleRegenerateBackupCodes}
              disabled={isLoading || !password}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              data-testid="confirm-regenerate-codes"
            >
              {isLoading ? "Regenerating..." : "Regenerate Codes"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("idle"); setMessage(null); }}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      {message && (
        <p
          className={`mt-2 text-xs ${
            message.success ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}
          data-testid="2fa-message"
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
