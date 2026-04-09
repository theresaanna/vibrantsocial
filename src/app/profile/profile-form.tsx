"use client";

import { useActionState, useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { updateProfile } from "./actions";
import { BioEditor } from "@/components/bio-editor";
import { BioRevisionHistory } from "@/components/bio-revision-history";
import { PushNotificationToggle } from "@/components/push-notification-toggle";
import { toast } from "sonner";
import { AvatarSection } from "./avatar-section";
import { EmailSection } from "./email-section";
import { StarsSection } from "./stars-section";
import { LinkedAccountsSection } from "./linked-accounts-section";
import { DeleteAccountSection } from "./delete-account-section";
import { PasswordSection } from "./password-section";
import { TwoFactorSection } from "./two-factor-section";

interface ProfileFormProps {
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    bio: string | null;
    profileContainerOpacity: number | null;
    profileFrameId: string | null;
  };
  email: string | null;
  emailVerified: boolean;
  pendingEmail: string | null;
  currentAvatar: string | null;
  oauthImage: string | null;
  ageVerified: boolean;
  showGraphicByDefault: boolean;
  showNsfwContent: boolean;
  hideSensitiveOverlay: boolean;
  hideNsfwOverlay: boolean;
  emailOnComment: boolean;
  emailOnNewChat: boolean;
  emailOnMention: boolean;
  emailOnFriendRequest: boolean;
  emailOnSubscribedPost: boolean;
  emailOnSubscribedComment: boolean;
  emailOnTagPost: boolean;
  pushEnabled: boolean;
  isProfilePublic: boolean;
  hideWallFromFeed: boolean;
  phoneVerified: boolean;
  phoneNumber: string | null;
  twoFactorEnabled: boolean;
  isCredentialsUser: boolean;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  isPremium: boolean;
  stars: number;
  starsSpent: number;
  referralCode: string;
  userEmail: string | null;
}

interface ProfileState {
  success: boolean;
  message: string;
}

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export function ProfileForm({ user, email, emailVerified, pendingEmail, currentAvatar, oauthImage, ageVerified, showGraphicByDefault, showNsfwContent, hideSensitiveOverlay, hideNsfwOverlay, emailOnComment, emailOnNewChat, emailOnMention, emailOnFriendRequest, emailOnSubscribedPost, emailOnSubscribedComment, emailOnTagPost, pushEnabled: initialPushEnabled, isProfilePublic, hideWallFromFeed, phoneVerified, phoneNumber, twoFactorEnabled, isCredentialsUser, birthdayMonth: initialBirthdayMonth, birthdayDay: initialBirthdayDay, isPremium, stars, starsSpent, referralCode, userEmail }: ProfileFormProps) {
  const { update } = useSession();
  const [usernameValue, setUsernameValue] = useState(user.username ?? "");
  const [displayNameValue, setDisplayNameValue] = useState(user.displayName ?? "");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [savedUsername, setSavedUsername] = useState(user.username);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [copied, setCopied] = useState(false);
  const hasMountedRef = useRef(false);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pushEnabled, setPushEnabled] = useState(initialPushEnabled);
  const [showRevisions, setShowRevisions] = useState(false);
  const [frameId, setFrameId] = useState<string | null>(user.profileFrameId);

  const [birthdayMonth, setBirthdayMonth] = useState<string>(initialBirthdayMonth ? String(initialBirthdayMonth) : "");
  const [birthdayDay, setBirthdayDay] = useState<string>(initialBirthdayDay ? String(initialBirthdayDay) : "");

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

  const handleFrameChange = useCallback((id: string | null) => {
    setFrameId(id);
    scheduleAutosave();
  }, [scheduleAutosave]);

  const handlePushToggle = useCallback((val: boolean) => {
    setPushEnabled(val);
    scheduleAutosave();
  }, [scheduleAutosave]);

  const displayName = user.displayName ?? "?";

  return (
    <div className="space-y-6">
      {/* Avatar upload + frame */}
      <AvatarSection
        currentAvatar={currentAvatar}
        oauthImage={oauthImage}
        initialFrameId={user.profileFrameId}
        displayName={displayName}
        isPremium={isPremium}
        userEmail={userEmail}
        onFrameChange={handleFrameChange}
      />

      {/* Share profile button */}
      {savedUsername && (
        <button
          type="button"
          onClick={async () => {
            const url = `${window.location.origin}/${savedUsername}${referralCode ? `?ref=${referralCode}` : ""}`;
            if (navigator.share) {
              try {
                await navigator.share({ title: `@${savedUsername}`, url });
                return;
              } catch {
                // User cancelled or share failed, fall through to clipboard
              }
            }
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Clipboard not available
            }
          }}
          className="flex items-center gap-1.5 self-start rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-semibold text-zinc-700 transition-all hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-600 dark:bg-transparent dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
        >
          {copied ? (
            "Copied!"
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.474l6.733-3.367A2.52 2.52 0 0113 4.5z" />
              </svg>
              Share Profile
            </>
          )}
        </button>
      )}

      {/* Email address */}
      <EmailSection
        email={email}
        emailVerified={emailVerified}
        pendingEmail={pendingEmail}
      />

      {/* Change Password */}
      <PasswordSection isCredentialsUser={isCredentialsUser} />

      {/* Two-Factor Authentication */}
      <TwoFactorSection
        twoFactorEnabled={twoFactorEnabled}
        isCredentialsUser={isCredentialsUser}
      />

      {/* Phone verification */}
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
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

      {/* Stars */}
      <StarsSection
        stars={stars}
        starsSpent={starsSpent}
        referralCode={referralCode}
      />

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
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200"
          >
            Username / URL path
          </label>
          <div className="mt-1 flex items-center rounded-lg border border-zinc-300 dark:border-zinc-600">
            <span className="shrink-0 select-none pl-3 text-sm text-zinc-400 dark:text-zinc-500">
              https://vibrantsocial.app/
            </span>
            <input
              id="username"
              name="username"
              type="text"
              value={usernameValue}
              onChange={(e) => setUsernameValue(e.target.value)}
              onFocus={cancelAutosave}
              className="block w-full rounded-r-lg border-0 bg-transparent px-1 py-2 text-sm focus:ring-0 dark:text-zinc-100"
              placeholder="your_username"
            />
          </div>
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
            className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200"
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
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
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

        <Link
          href="/theme"
          className="flex items-center gap-2 rounded-lg border border-zinc-200 p-3 text-sm font-medium text-pink-600 transition-colors hover:bg-pink-50 dark:border-zinc-700 dark:text-pink-400 dark:hover:bg-pink-900/20"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
          </svg>
          Customize your theme, font, and background
        </Link>

        <Link
          href="/profile/links"
          className="flex items-center gap-2 rounded-lg border border-zinc-200 p-3 text-sm font-medium text-pink-600 transition-colors hover:bg-pink-50 dark:border-zinc-700 dark:text-pink-400 dark:hover:bg-pink-900/20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1" />
          </svg>
          Set up your links page
        </Link>

        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <p className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
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
              <div className="space-y-1">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Age verification is required to view sensitive and graphic content.
                </p>
                <Link
                  href="/premium"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                    <svg className="h-2 w-2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                  Included with Premium
                </Link>
              </div>
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
                Show NSFW content in feed
              </span>
            </label>
            <p className="ml-6 text-xs text-zinc-500 dark:text-zinc-400">
              When enabled, NSFW posts will appear in your feed and on profile Posts tabs. A click-to-reveal overlay will still be shown.
            </p>
            {ageVerified && (
              <>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="hideNsfwOverlay"
                    value="true"
                    defaultChecked={hideNsfwOverlay}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Hide overlay on NSFW content
                  </span>
                </label>
                <p className="ml-6 text-xs text-zinc-500 dark:text-zinc-400">
                  When enabled, NSFW posts will be visible without clicking to reveal.
                </p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="hideSensitiveOverlay"
                    value="true"
                    defaultChecked={hideSensitiveOverlay}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Hide overlay on Sensitive content
                  </span>
                </label>
                <p className="ml-6 text-xs text-zinc-500 dark:text-zinc-400">
                  When enabled, Sensitive posts will be visible without clicking to reveal and will appear in media feeds.
                </p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="showGraphicByDefault"
                    value="true"
                    defaultChecked={showGraphicByDefault}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Hide overlay on Graphic/Explicit content
                  </span>
                </label>
                <p className="ml-6 text-xs text-zinc-500 dark:text-zinc-400">
                  When enabled, Graphic/Explicit posts will be visible without clicking to reveal and will appear in media feeds.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Email notifications */}
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <p className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
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
                name="emailOnSubscribedComment"
                value="true"
                defaultChecked={emailOnSubscribedComment}
                className="rounded"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                New comments on watched posts
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
          <p className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Push Notifications
          </p>
          <input type="hidden" name="pushEnabled" value={pushEnabled ? "true" : "false"} />
          <PushNotificationToggle
            enabled={pushEnabled}
            onToggle={handlePushToggle}
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
      <LinkedAccountsSection />

      {/* Delete Account */}
      <DeleteAccountSection username={user.username} />
    </div>
  );
}
