"use client";

import { useActionState, useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { updateProfile, removeAvatar } from "./actions";
import { BioEditor } from "@/components/bio-editor";
import { BioRevisionHistory } from "@/components/bio-revision-history";
import { ThemeEditor } from "@/components/theme-editor";
import { PushNotificationToggle } from "@/components/push-notification-toggle";

interface ProfileFormProps {
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    bio: string | null;
    profileBgColor: string | null;
    profileTextColor: string | null;
    profileLinkColor: string | null;
    profileSecondaryColor: string | null;
    profileContainerColor: string | null;
  };
  currentAvatar: string | null;
  oauthImage: string | null;
  biometricVerified: boolean;
  showNsfwByDefault: boolean;
  emailOnComment: boolean;
  emailOnNewChat: boolean;
  emailOnMention: boolean;
  pushEnabled: boolean;
  phoneVerified: boolean;
  phoneNumber: string | null;
  isCredentialsUser: boolean;
}

interface ProfileState {
  success: boolean;
  message: string;
}

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export function ProfileForm({ user, currentAvatar, oauthImage, biometricVerified, showNsfwByDefault, emailOnComment, emailOnNewChat, emailOnMention, pushEnabled: initialPushEnabled, phoneVerified, phoneNumber, isCredentialsUser }: ProfileFormProps) {
  const { update } = useSession();
  const [usernameValue, setUsernameValue] = useState(user.username ?? "");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [savedUsername, setSavedUsername] = useState(user.username);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const hasMountedRef = useRef(false);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(currentAvatar);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [showRevisions, setShowRevisions] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pushEnabled, setPushEnabled] = useState(initialPushEnabled);

  const displayedAvatar = avatarPreview || oauthImage;
  const displayName = user.displayName ?? "?";
  const initial = displayName[0]?.toUpperCase() ?? "?";

  const usernameStatusRef = useRef(usernameStatus);
  usernameStatusRef.current = usernameStatus;

  const [state, formAction, isPending] = useActionState(
    async (prevState: ProfileState, formData: FormData) => {
      const result = await updateProfile(prevState, formData);
      if (result.success) {
        const newUsername = (formData.get("username") as string) || null;
        setSavedUsername(newUsername);
        setUsernameStatus("idle");
        await update({
          user: {
            username: newUsername,
            displayName: (formData.get("displayName") as string) || null,
            bio: (formData.get("bio") as string) || null,
          },
        });
      }
      return result;
    },
    { success: false, message: "" }
  );

  // Track save status from form action state
  useEffect(() => {
    if (isPending) {
      setSaveStatus("saving");
    } else if (state.message) {
      setSaveStatus(state.success ? "saved" : "error");
      if (state.success) {
        const timer = setTimeout(() => setSaveStatus("idle"), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [isPending, state]);

  const scheduleAutosave = useCallback(() => {
    // Skip autosave on initial mount
    if (!hasMountedRef.current) return;

    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => {
      const status = usernameStatusRef.current;
      if (status === "taken" || status === "invalid" || status === "checking") return;
      formRef.current?.requestSubmit();
    }, 1500);
  }, []);

  // Mark as mounted after first render
  useEffect(() => {
    hasMountedRef.current = true;
    return () => {
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = usernameValue.trim().toLowerCase();

    if (!trimmed) {
      setUsernameStatus("idle");
      return;
    }

    if (trimmed === savedUsername?.toLowerCase()) {
      setUsernameStatus("idle");
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(trimmed)) {
      setUsernameStatus("invalid");
      return;
    }

    setUsernameStatus("checking");

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/username-check?username=${encodeURIComponent(trimmed)}`
        );
        const data = await res.json();
        setUsernameStatus(data.available ? "available" : "taken");
        // Autosave after username check completes and is available
        if (data.available) {
          scheduleAutosave();
        }
      } catch {
        setUsernameStatus("idle");
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [usernameValue, savedUsername, scheduleAutosave]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setAvatarError("File must be JPEG, PNG, GIF, or WebP");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("File must be under 5MB");
      return;
    }

    setAvatarUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/avatar", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setAvatarError(data.error || "Upload failed");
        return;
      }

      setAvatarPreview(data.url);
      await update({ user: { avatar: data.url } });
    } catch {
      setAvatarError("Upload failed. Please try again.");
    } finally {
      setAvatarUploading(false);
      // Reset file input so re-selecting the same file triggers onChange
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setAvatarUploading(true);
    setAvatarError(null);

    try {
      await removeAvatar();
      setAvatarPreview(null);
      await update({ user: { avatar: null } });
    } catch {
      setAvatarError("Failed to remove avatar");
    } finally {
      setAvatarUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Avatar upload */}
      <div className="flex items-center gap-4">
        {displayedAvatar ? (
          <img
            src={displayedAvatar}
            alt=""
            referrerPolicy="no-referrer"
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-200 text-xl font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            {initial}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label
              className={`cursor-pointer rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 ${
                avatarUploading ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {avatarUploading ? "Uploading..." : "Upload Photo"}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={avatarUploading}
              />
            </label>

            {avatarPreview && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={avatarUploading}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                Remove
              </button>
            )}
          </div>

          {avatarError && (
            <p className="text-xs text-red-600">{avatarError}</p>
          )}
          <p className="text-xs text-zinc-400">JPEG, PNG, GIF, or WebP. Max 5MB.</p>
        </div>
      </div>

      {/* Phone verification & profile link */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Phone Verification
          </p>
          {phoneVerified ? (
            <p className="mt-1 text-sm text-green-600 dark:text-green-400">
              Verified: {phoneNumber?.replace(/(\+\d{1,3})\d+(\d{4})/, "$1****$2")}
            </p>
          ) : (
            <div className="mt-1 flex items-center justify-between">
              <p className="text-sm text-zinc-500">
                {isCredentialsUser
                  ? "Verify your phone to secure your account"
                  : "Add a phone number for extra security"}
              </p>
              <Link
                href="/verify-phone"
                className="ml-2 shrink-0 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Verify
              </Link>
            </div>
          )}
        </div>

        {savedUsername ? (
          <div className="flex flex-col justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
            <Link
              href={`/${savedUsername}`}
              className="text-sm font-semibold text-zinc-900 transition-colors hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-400"
            >
              View public profile &rarr;
            </Link>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/${savedUsername}`
                );
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="mt-2 self-start rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {copied ? "Copied!" : "Share Profile"}
            </button>
          </div>
        ) : (
          <div className="flex items-center rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
            <p className="text-sm text-zinc-500">
              Set a username below to get your profile link
            </p>
          </div>
        )}
      </div>

      {/* Profile fields */}
      <form
        ref={formRef}
        action={formAction}
        onChange={scheduleAutosave}
        className="space-y-4"
      >
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            value={usernameValue}
            onChange={(e) => setUsernameValue(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="your_username"
          />
          {usernameStatus === "checking" && (
            <p className="mt-1 text-xs text-zinc-400">Checking availability...</p>
          )}
          {usernameStatus === "available" && (
            <p className="mt-1 text-xs text-green-600">Username is available</p>
          )}
          {usernameStatus === "taken" && (
            <p className="mt-1 text-xs text-red-600">Username is already taken</p>
          )}
          {usernameStatus === "invalid" && (
            <p className="mt-1 text-xs text-red-600">
              3–30 characters, letters, numbers, and underscores only
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="displayName"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Display Name
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            defaultValue={user.displayName ?? ""}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div>
          <BioEditor initialContent={user.bio} onChange={scheduleAutosave} />
          <button
            type="button"
            onClick={() => setShowRevisions(true)}
            className="mt-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Revision history
          </button>
        </div>

        {showRevisions && (
          <BioRevisionHistory
            onClose={() => setShowRevisions(false)}
            onRestore={() => {
              window.location.reload();
            }}
          />
        )}

        <ThemeEditor
          initialColors={{
            profileBgColor: user.profileBgColor ?? undefined,
            profileTextColor: user.profileTextColor ?? undefined,
            profileLinkColor: user.profileLinkColor ?? undefined,
            profileSecondaryColor: user.profileSecondaryColor ?? undefined,
            profileContainerColor: user.profileContainerColor ?? undefined,
          }}
          username={savedUsername ?? null}
          displayName={user.displayName}
          bio={user.bio}
          avatarSrc={avatarPreview || oauthImage}
          onChange={scheduleAutosave}
        />

        {biometricVerified && (
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="showNsfwByDefault"
                value="true"
                defaultChecked={showNsfwByDefault}
                className="rounded"
              />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Show NSFW content by default
              </span>
            </label>
            <p className="mt-1 ml-6 text-xs text-zinc-500 dark:text-zinc-400">
              When enabled, NSFW posts will be visible without clicking to reveal.
            </p>
          </div>
        )}

        {/* Email notifications */}
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <p className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Email Notifications
          </p>
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="emailOnComment"
                value="true"
                defaultChecked={emailOnComment}
                className="rounded"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                New comments on my posts
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="emailOnNewChat"
                value="true"
                defaultChecked={emailOnNewChat}
                className="rounded"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                New chat conversations
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="emailOnMention"
                value="true"
                defaultChecked={emailOnMention}
                className="rounded"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                Mentions in posts and comments
              </span>
            </label>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Choose which email notifications you&apos;d like to receive.
          </p>
        </div>

        {/* Push notifications */}
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <p className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Push Notifications
          </p>
          <input type="hidden" name="pushEnabled" value={pushEnabled ? "true" : "false"} />
          <PushNotificationToggle
            enabled={pushEnabled}
            onToggle={(val) => {
              setPushEnabled(val);
              scheduleAutosave();
            }}
          />
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Receive browser notifications even when the tab is closed.
          </p>
        </div>

        {/* Autosave status */}
        <div className="flex items-center justify-between">
          <p className={`text-sm ${
            saveStatus === "saving" ? "text-zinc-400" :
            saveStatus === "saved" ? "text-green-600" :
            saveStatus === "error" ? "text-red-600" : "text-transparent"
          }`}>
            {saveStatus === "saving" ? "Saving..." :
             saveStatus === "saved" ? "Saved" :
             saveStatus === "error" ? state.message :
             "\u00A0"}
          </p>
          <button
            type="submit"
            disabled={isPending || usernameStatus === "taken"}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
