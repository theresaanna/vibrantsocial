"use client";

import { useActionState, useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { updateProfile, removeAvatar, requestEmailChange, cancelEmailChange, deleteAccount } from "./actions";
import { unlinkAccount, getLinkedAccounts } from "./account-linking-actions";
import { BioEditor } from "@/components/bio-editor";
import { BioRevisionHistory } from "@/components/bio-revision-history";
import { ThemeEditor } from "@/components/theme-editor";
import { BackgroundEditor } from "@/components/background-editor";
import { SparkleEditor } from "@/components/sparkle-editor";
import type { BackgroundDefinition } from "@/lib/profile-backgrounds";
import type { CustomPresetData } from "@/lib/profile-themes";
import { FrameSelector } from "@/components/frame-selector";
import { PremiumCrown } from "@/components/premium-crown";
import { FramedAvatar } from "@/components/framed-avatar";
import { FontSelector } from "@/components/font-selector";
import { PushNotificationToggle } from "@/components/push-notification-toggle";
import { LinkAccountModal } from "@/components/link-account-modal";
import { AvatarCropperModal } from "@/components/avatar-cropper-modal";
import type { LinkedAccount } from "@/types/next-auth";
import { toast } from "sonner";

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
    profileContainerOpacity: number | null;
    profileFrameId: string | null;
    profileBgImage: string | null;
    profileBgRepeat: string | null;
    profileBgAttachment: string | null;
    profileBgSize: string | null;
    profileBgPosition: string | null;
    sparklefallEnabled: boolean;
    sparklefallPreset: string | null;
    sparklefallSparkles: string | null;
    sparklefallColors: string | null;
    sparklefallInterval: number | null;
    sparklefallWind: number | null;
    sparklefallMaxSparkles: number | null;
    sparklefallMinSize: number | null;
    sparklefallMaxSize: number | null;
    usernameFont: string | null;
  };
  email: string | null;
  pendingEmail: string | null;
  currentAvatar: string | null;
  oauthImage: string | null;
  ageVerified: boolean;
  showGraphicByDefault: boolean;
  showNsfwContent: boolean;
  emailOnComment: boolean;
  emailOnNewChat: boolean;
  emailOnMention: boolean;
  emailOnFriendRequest: boolean;
  emailOnSubscribedPost: boolean;
  emailOnTagPost: boolean;
  pushEnabled: boolean;
  isProfilePublic: boolean;
  hideWallFromFeed: boolean;
  phoneVerified: boolean;
  phoneNumber: string | null;
  isCredentialsUser: boolean;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  isPremium: boolean;
  stars: number;
  starsSpent: number;
  referralCode: string;
  backgrounds: BackgroundDefinition[];
  userEmail: string | null;
  customPresets: CustomPresetData[];
}

interface ProfileState {
  success: boolean;
  message: string;
}

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export function ProfileForm({ user, email, pendingEmail, currentAvatar, oauthImage, ageVerified, showGraphicByDefault, showNsfwContent, emailOnComment, emailOnNewChat, emailOnMention, emailOnFriendRequest, emailOnSubscribedPost, emailOnTagPost, pushEnabled: initialPushEnabled, isProfilePublic, hideWallFromFeed, phoneVerified, phoneNumber, isCredentialsUser, birthdayMonth: initialBirthdayMonth, birthdayDay: initialBirthdayDay, isPremium, stars, starsSpent, referralCode, backgrounds, userEmail, customPresets }: ProfileFormProps) {
  const { update } = useSession();
  const [usernameValue, setUsernameValue] = useState(user.username ?? "");
  const [displayNameValue, setDisplayNameValue] = useState(user.displayName ?? "");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [savedUsername, setSavedUsername] = useState(user.username);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const [showStarsPopup, setShowStarsPopup] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const hasMountedRef = useRef(false);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(currentAvatar);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [showRevisions, setShowRevisions] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pushEnabled, setPushEnabled] = useState(initialPushEnabled);
  const [isCancellingEmail, setIsCancellingEmail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [frameId, setFrameId] = useState<string | null>(user.profileFrameId);
  const [showFrameSelector, setShowFrameSelector] = useState(false);
  const [usernameFont, setUsernameFont] = useState<string | null>(user.usernameFont);
  const [birthdayMonth, setBirthdayMonth] = useState<string>(initialBirthdayMonth ? String(initialBirthdayMonth) : "");
  const [birthdayDay, setBirthdayDay] = useState<string>(initialBirthdayDay ? String(initialBirthdayDay) : "");
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

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

  const [emailState, emailFormAction, isEmailPending] = useActionState(
    requestEmailChange,
    { success: false, message: "" }
  );

  const [deleteState, deleteFormAction, isDeleting] = useActionState(
    async (prevState: ProfileState, formData: FormData) => {
      const result = await deleteAccount(prevState, formData);
      if (result.success) {
        await signOut({ redirectTo: "/" });
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
        const username = savedUsername || user.username;
        toast.success(
          <span>
            Changes saved.{" "}
            <a href={`/${username}`} className="underline font-medium">
              View your profile
            </a>
          </span>
        );
        const timer = setTimeout(() => setSaveStatus("idle"), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [isPending, state]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelAutosave = useCallback(() => {
    if (autosaveRef.current) {
      clearTimeout(autosaveRef.current);
      autosaveRef.current = null;
    }
  }, []);

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

  // Load linked accounts on mount
  useEffect(() => {
    getLinkedAccounts().then(setLinkedAccounts);
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

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setAvatarError("File must be JPEG, PNG, GIF, or WebP");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setAvatarError("File must be under 10MB");
      return;
    }

    setCropFile(file);
    // Reset file input so re-selecting the same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCroppedAvatar(blob: Blob) {
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const formData = new FormData();
      formData.append("file", blob, "avatar.jpg");
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
      setCropFile(null);
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
        <FramedAvatar
          src={displayedAvatar}
          initial={initial}
          size={80}
          frameId={frameId}
          referrerPolicy="no-referrer"
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
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
            <span className="relative">
              <button
                type="button"
                onClick={() => setShowFrameSelector(true)}
                disabled={!isPremium}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                data-testid="choose-frame-button"
              >
                {frameId ? "Change Frame" : "Add Frame"}
              </button>
              <PremiumCrown href="/premium" />
            </span>
          </div>

          {avatarError && (
            <p className="text-xs text-red-600">{avatarError}</p>
          )}
          <p className="text-xs text-zinc-400">JPEG, PNG, GIF, or WebP. Max 10MB.</p>
        </div>
      </div>

      {showFrameSelector && (
        <FrameSelector
          currentFrameId={frameId}
          avatarSrc={displayedAvatar}
          initial={initial}
          isPremium={isPremium}
          userEmail={userEmail}
          onSelect={(id) => { setFrameId(id); scheduleAutosave(); }}
          onClose={() => setShowFrameSelector(false)}
        />
      )}

      {/* Email address */}
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Email Address
        </p>
        {email && !pendingEmail && (
          <p className="mt-1 text-sm text-green-600 dark:text-green-400">
            Verified: {email}
          </p>
        )}
        {pendingEmail && (
          <div className="mt-1 flex items-center justify-between">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Verification sent to {pendingEmail}
            </p>
            <button
              type="button"
              disabled={isCancellingEmail}
              onClick={async () => {
                setIsCancellingEmail(true);
                try {
                  await cancelEmailChange();
                } finally {
                  setIsCancellingEmail(false);
                }
              }}
              className="ml-2 shrink-0 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        )}
        <form action={emailFormAction} className="mt-3 flex gap-2">
          <input
            name="email"
            type="email"
            defaultValue={email ?? ""}
            placeholder="you@example.com"
            className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={isEmailPending}
            className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isEmailPending ? "Sending..." : email ? "Update" : "Add"}
          </button>
        </form>
        {emailState.message && (
          <p
            className={`mt-2 text-xs ${
              emailState.success
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {emailState.message}
          </p>
        )}
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
                  ? "Verify your phone for community safety"
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

        {/* Stars container */}
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowStarsPopup(true)}
              className="flex items-center gap-2 focus:outline-none"
              data-testid="stars-count"
            >
              <span
                className="relative inline-flex items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  backgroundImage: "url(/star.png)",
                  backgroundSize: "contain",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                }}
              >
                <span className="relative text-xs font-bold text-white" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                  {stars}
                </span>
              </span>
              <div className="text-left">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {stars} {stars === 1 ? "star" : "stars"}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Tap to learn more
                </p>
              </div>
            </button>
            {stars >= 500 && (
              <button
                type="button"
                disabled={redeeming}
                onClick={async () => {
                  setRedeeming(true);
                  try {
                    const res = await fetch("/api/redeem-stars", { method: "POST" });
                    const data = await res.json();
                    if (res.ok) {
                      toast.success("Premium activated! Enjoy your free month.");
                      window.location.reload();
                    } else {
                      toast.error(data.error || "Failed to redeem stars");
                    }
                  } catch {
                    toast.error("Something went wrong");
                  } finally {
                    setRedeeming(false);
                  }
                }}
                className="rounded-lg bg-gradient-to-r from-yellow-400 to-amber-500 px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                data-testid="redeem-stars"
              >
                {redeeming ? "Redeeming..." : "Redeem for Premium"}
              </button>
            )}
          </div>
          <div className="mt-3 flex gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-700">
            <div className="text-center">
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{stars + starsSpent}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Lifetime</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{starsSpent}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Spent</p>
            </div>
          </div>
          {referralCode && (
            <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-700">
              <p className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Your referral link</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" data-testid="referral-link">
                  {typeof window !== "undefined" ? `${window.location.origin}/signup?ref=${referralCode}` : `/signup?ref=${referralCode}`}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/signup?ref=${referralCode}`
                    );
                    setReferralCopied(true);
                    setTimeout(() => setReferralCopied(false), 2000);
                  }}
                  className="shrink-0 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  {referralCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}
          {showStarsPopup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowStarsPopup(false)}>
              <div
                className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-800"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">How to Earn Stars</h3>
                  <button
                    type="button"
                    onClick={() => setShowStarsPopup(false)}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    &times;
                  </button>
                </div>
                <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-300">
                  Stars are earned by being active on VibrantSocial. The more you engage, the more stars you collect!
                </p>
                <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <li className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
                    Posting new content
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
                    Commenting on posts
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
                    Liking posts
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
                    Reposting content
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
                    Referring new users
                  </li>
                </ul>
                <div className="mt-4 rounded-lg bg-zinc-100 p-3 dark:bg-zinc-700">
                  <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Redeem stars</p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    Collect 500 stars to exchange for a free month of premium!
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-zinc-100 py-2 dark:bg-zinc-700">
                  <span
                    className="relative inline-flex items-center justify-center"
                    style={{
                      width: 28,
                      height: 28,
                      backgroundImage: "url(/star.png)",
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "center",
                    }}
                  >
                    <span className="relative text-[10px] font-bold text-white" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                      {stars}
                    </span>
                  </span>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    You have {stars} {stars === 1 ? "star" : "stars"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Share container */}
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
        onChange={(e) => {
          // Only autosave for non-text inputs (checkboxes, selects, etc.)
          // Text inputs use onBlur to avoid resetting mid-edit
          const target = e.target as HTMLElement;
          if (target instanceof HTMLInputElement && (target.type === "text" || target.type === "email")) return;
          if (target instanceof HTMLTextAreaElement) return;
          scheduleAutosave();
        }}
        className="space-y-4"
      >
        <input type="hidden" name="profileFrameId" value={frameId ?? ""} />
        <input type="hidden" name="usernameFont" value={usernameFont ?? ""} />
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
            onFocus={cancelAutosave}
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
            value={displayNameValue}
            onChange={(e) => setDisplayNameValue(e.target.value)}
            onBlur={scheduleAutosave}
            onFocus={cancelAutosave}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Birthday
          </label>
          <div className="mt-1 flex gap-2">
            <select
              name="birthdayMonth"
              value={birthdayMonth}
              onChange={(e) => { setBirthdayMonth(e.target.value); }}
              className="block w-1/2 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              data-testid="birthday-month"
            >
              <option value="">Month</option>
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
            <select
              name="birthdayDay"
              value={birthdayDay}
              onChange={(e) => { setBirthdayDay(e.target.value); }}
              className="block w-1/2 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              data-testid="birthday-day"
            >
              <option value="">Day</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            This is used for cute in-app purposes only. 🥳
          </p>
        </div>

        <FontSelector
          currentFontId={usernameFont}
          displayName={displayNameValue || user.displayName || ""}
          isPremium={isPremium}
          userEmail={userEmail}
          onSelect={(fontId) => { setUsernameFont(fontId); scheduleAutosave(); }}
        />

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
          initialContainerOpacity={user.profileContainerOpacity ?? 0}
          username={savedUsername ?? null}
          displayName={user.displayName}
          bio={user.bio}
          avatarSrc={avatarPreview || oauthImage}
          onChange={scheduleAutosave}
          isPremium={isPremium}
          userEmail={userEmail}
          customPresets={customPresets}
        />

        <BackgroundEditor
          backgrounds={backgrounds}
          initialBackground={{
            profileBgImage: user.profileBgImage,
            profileBgRepeat: user.profileBgRepeat,
            profileBgAttachment: user.profileBgAttachment,
            profileBgSize: user.profileBgSize,
            profileBgPosition: user.profileBgPosition,
          }}
          isPremium={isPremium}
          userEmail={userEmail}
          onChange={scheduleAutosave}
        />

        <SparkleEditor
          initialConfig={{
            sparklefallEnabled: user.sparklefallEnabled,
            sparklefallPreset: user.sparklefallPreset,
            sparklefallSparkles: user.sparklefallSparkles,
            sparklefallColors: user.sparklefallColors,
            sparklefallInterval: user.sparklefallInterval,
            sparklefallWind: user.sparklefallWind,
            sparklefallMaxSparkles: user.sparklefallMaxSparkles,
            sparklefallMinSize: user.sparklefallMinSize,
            sparklefallMaxSize: user.sparklefallMaxSize,
          }}
          isPremium={isPremium}
          userEmail={userEmail}
          onChange={scheduleAutosave}
        />

        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <p className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Content Visibility
          </p>
          <div className="space-y-3">
            {/* Age verification status */}
            <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Age verification
                </span>
                {ageVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                    Not verified
                  </span>
                )}
              </div>
              {!ageVerified && (
                <Link
                  href="/age-verify"
                  className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Verify now
                </Link>
              )}
            </div>
            {!ageVerified && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Age verification is required to view sensitive and graphic content.
              </p>
            )}

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="showNsfwContent"
                value="true"
                defaultChecked={showNsfwContent}
                className="rounded"
              />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Show NSFW content
              </span>
            </label>
            <p className="ml-6 text-xs text-zinc-500 dark:text-zinc-400">
              When enabled, NSFW posts will appear in your feed and on profile Posts tabs without an overlay.
            </p>
            {ageVerified && (
              <>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="showGraphicByDefault"
                    value="true"
                    defaultChecked={showGraphicByDefault}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Show Graphic/Explicit content by default
                  </span>
                </label>
                <p className="ml-6 text-xs text-zinc-500 dark:text-zinc-400">
                  When enabled, Graphic/Explicit posts will be visible without clicking to reveal.
                </p>
              </>
            )}
          </div>
        </div>

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
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="emailOnFriendRequest"
                value="true"
                defaultChecked={emailOnFriendRequest}
                className="rounded"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                Friend requests
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="emailOnSubscribedPost"
                value="true"
                defaultChecked={emailOnSubscribedPost}
                className="rounded"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                New posts from subscribed users
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="emailOnTagPost"
                value="true"
                defaultChecked={emailOnTagPost}
                className="rounded"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                New posts in subscribed tags
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

        {/* Profile visibility */}
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isProfilePublic"
              value="true"
              defaultChecked={isProfilePublic}
              className="rounded"
            />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Public profile
            </span>
          </label>
          <p className="mt-1 ml-6 text-xs text-zinc-500 dark:text-zinc-400">
            When disabled, only logged-in users can view your profile and posts.
          </p>
        </div>

        {/* Wall posts visibility */}
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="hideWallFromFeed"
              value="true"
              defaultChecked={hideWallFromFeed}
              className="rounded"
            />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Show wall posts in a separate tab
            </span>
          </label>
          <p className="mt-1 ml-6 text-xs text-zinc-500 dark:text-zinc-400">
            When enabled, wall posts from friends will appear in a &ldquo;Wall&rdquo; tab instead of mixed into your main Posts feed.
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

      {/* Linked Accounts */}
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700" data-testid="linked-accounts-section">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Linked Accounts
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Link multiple accounts to switch between them without logging out.
        </p>

        {linkedAccounts.length > 0 && (
          <div className="mt-3 space-y-2">
            {linkedAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800"
                data-testid={`linked-account-${account.username}`}
              >
                <div className="flex items-center gap-2">
                  {account.avatar ? (
                    <img
                      src={account.avatar}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-blue-500 text-sm font-medium text-white">
                      {(account.displayName || account.username || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {account.displayName || account.username}
                    </p>
                    {account.username && (
                      <p className="text-xs text-zinc-500">@{account.username}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={unlinkingId !== null}
                  onClick={async () => {
                    setUnlinkingId(account.id);
                    try {
                      const result = await unlinkAccount(account.id);
                      if (result.success) {
                        setLinkedAccounts(result.linkedAccounts ?? []);
                        update({ refreshLinkedAccounts: true });
                      }
                    } finally {
                      setUnlinkingId(null);
                    }
                  }}
                  className="text-sm font-medium text-red-600 transition-colors hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                  data-testid={`unlink-${account.username}`}
                >
                  {unlinkingId === account.id ? "Unlinking..." : "Unlink"}
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowLinkModal(true)}
          className="mt-3 flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          data-testid="link-account-button"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Link another account
        </button>
      </div>

      {showLinkModal && (
        <LinkAccountModal
          isOpen={showLinkModal}
          onClose={() => setShowLinkModal(false)}
          onLinked={() => {
            getLinkedAccounts().then(setLinkedAccounts);
          }}
        />
      )}

      {cropFile && (
        <AvatarCropperModal
          file={cropFile}
          onSave={handleCroppedAvatar}
          onCancel={() => setCropFile(null)}
          uploading={avatarUploading}
        />
      )}

      {/* Delete Account */}
      <div className="rounded-lg border border-red-200 p-4 dark:border-red-900/50">
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          Delete Account
        </p>
        {!showDeleteConfirm ? (
          <>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Permanently delete your account and all associated data.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              data-testid="delete-account-button"
            >
              Delete Account
            </button>
          </>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                This action is permanent and cannot be undone.
              </p>
              <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                Your posts, comments, messages, and all other data will be permanently deleted.
                If someone quoted your post, the quote will remain but your original post will
                be replaced with a &ldquo;user deleted&rdquo; notice.
              </p>
            </div>
            <form action={deleteFormAction}>
              <label
                htmlFor="deleteConfirmation"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Type <span className="font-mono text-red-600 dark:text-red-400">delete {user.username}</span> to confirm
              </label>
              <input
                id="deleteConfirmation"
                name="confirmation"
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder={`delete ${user.username}`}
                autoComplete="off"
                data-testid="delete-confirmation-input"
              />
              {deleteState.message && !deleteState.success && (
                <p className="mt-1 text-xs text-red-600">{deleteState.message}</p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={
                    isDeleting ||
                    deleteConfirmation.trim().toLowerCase() !==
                      `delete ${user.username}`.toLowerCase()
                  }
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  data-testid="delete-account-confirm"
                >
                  {isDeleting ? "Deleting..." : "Delete My Account"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmation("");
                  }}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
