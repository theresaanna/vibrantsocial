import type { Metadata } from "next";
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isProfileIncomplete } from "@/lib/require-profile";
import { ProfileForm } from "./profile-form";
import { Suspense } from "react";
import Link from "next/link";
import { AutoAccountSwitch } from "@/components/auto-account-switch";
import { userThemeSelect, buildUserTheme } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";

export const metadata: Metadata = {
  title: "Edit Profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      ...userThemeSelect,
      username: true,
      email: true,
      emailVerified: true,
      pendingEmail: true,
      dateOfBirth: true,
      phoneNumber: true,
      phoneVerified: true,
      passwordHash: true,
      twoFactorEnabled: true,
      avatar: true,
      image: true,
      profileFrameId: true,
      profileContainerOpacity: true,
      ageVerified: true,
      showGraphicByDefault: true,
      showNsfwContent: true,
      hideSensitiveOverlay: true,
      hideNsfwOverlay: true,
      emailOnComment: true,
      emailOnNewChat: true,
      emailOnMention: true,
      emailOnFriendRequest: true,
      emailOnSubscribedPost: true,
      emailOnSubscribedComment: true,
      emailOnTagPost: true,
      pushEnabled: true,
      isProfilePublic: true,
      hideWallFromFeed: true,
      stars: true,
      starsSpent: true,
      referralCode: true,
    },
  });

  if (!user || isProfileIncomplete(user)) redirect("/complete-profile");

  const isCredentialsUser = !!user?.passwordHash;
  const isPremium = user?.tier === "premium";
  const oauthImage = user?.image ?? session.user.image ?? null;

  const profileTheme = buildUserTheme(user);

  return (
    <ThemedPage {...profileTheme} bare>
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
      <Suspense>
        <AutoAccountSwitch />
      </Suspense>
      <div className="w-full max-w-2xl space-y-6 rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-600">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Your Profile
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Manage your account details
            </p>
          </div>
        </div>

        <ProfileForm
          user={{
            ...session.user,
            profileContainerOpacity: user?.profileContainerOpacity ?? null,
            profileFrameId: user?.profileFrameId ?? null,
          }}
          currentAvatar={user?.avatar ?? null}
          oauthImage={oauthImage}
          ageVerified={!!user?.ageVerified}
          showGraphicByDefault={user?.showGraphicByDefault ?? false}
          showNsfwContent={user?.showNsfwContent ?? false}
          hideSensitiveOverlay={user?.hideSensitiveOverlay ?? false}
          hideNsfwOverlay={user?.hideNsfwOverlay ?? false}
          emailOnComment={user?.emailOnComment ?? true}
          emailOnNewChat={user?.emailOnNewChat ?? true}
          emailOnMention={user?.emailOnMention ?? true}
          emailOnFriendRequest={user?.emailOnFriendRequest ?? true}
          emailOnSubscribedPost={user?.emailOnSubscribedPost ?? true}
          emailOnSubscribedComment={user?.emailOnSubscribedComment ?? true}
          emailOnTagPost={user?.emailOnTagPost ?? true}
          pushEnabled={user?.pushEnabled ?? false}
          isProfilePublic={user?.isProfilePublic ?? true}
          hideWallFromFeed={user?.hideWallFromFeed ?? false}
          birthdayMonth={user?.birthdayMonth ?? null}
          birthdayDay={user?.birthdayDay ?? null}
          email={user?.email ?? null}
          emailVerified={!!user?.emailVerified}
          pendingEmail={user?.pendingEmail ?? null}
          phoneVerified={!!user?.phoneVerified}
          phoneNumber={user?.phoneNumber ?? null}
          twoFactorEnabled={user?.twoFactorEnabled ?? false}
          isCredentialsUser={isCredentialsUser}
          isPremium={isPremium}
          stars={user?.stars ?? 0}
          starsSpent={user?.starsSpent ?? 0}
          referralCode={user?.referralCode ?? ""}
          userEmail={user?.email ?? null}
        />

        <Link
          href="/blocked"
          data-testid="blocked-users-link"
          className="flex w-full items-center justify-between rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            Blocked Users
          </span>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
    </ThemedPage>
  );
}
