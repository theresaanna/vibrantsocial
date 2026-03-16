import type { Metadata } from "next";
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isProfileIncomplete } from "@/lib/require-profile";
import { ProfileForm } from "./profile-form";
import { Suspense } from "react";
import { AutoAccountSwitch } from "@/components/auto-account-switch";
import { getProfileBackgrounds } from "@/lib/profile-backgrounds.server";

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
      username: true,
      email: true,
      pendingEmail: true,
      dateOfBirth: true,
      phoneNumber: true,
      phoneVerified: true,
      passwordHash: true,
      avatar: true,
      image: true,
      profileFrameId: true,
      profileBgColor: true,
      profileTextColor: true,
      profileLinkColor: true,
      profileSecondaryColor: true,
      profileContainerColor: true,
      profileBgImage: true,
      profileBgRepeat: true,
      profileBgAttachment: true,
      profileBgSize: true,
      profileBgPosition: true,
      ageVerified: true,
      showGraphicByDefault: true,
      showNsfwContent: true,
      emailOnComment: true,
      emailOnNewChat: true,
      emailOnMention: true,
      emailOnFriendRequest: true,
      emailOnSubscribedPost: true,
      emailOnTagPost: true,
      pushEnabled: true,
      isProfilePublic: true,
      tier: true,
      stars: true,
    },
  });

  if (!user || isProfileIncomplete(user)) redirect("/complete-profile");

  const isCredentialsUser = !!user?.passwordHash;
  const isPremium = user?.tier === "premium";
  const oauthImage = user?.image ?? session.user.image ?? null;
  const backgrounds = getProfileBackgrounds();

  return (
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
            profileBgColor: user?.profileBgColor ?? null,
            profileTextColor: user?.profileTextColor ?? null,
            profileLinkColor: user?.profileLinkColor ?? null,
            profileSecondaryColor: user?.profileSecondaryColor ?? null,
            profileContainerColor: user?.profileContainerColor ?? null,
            profileFrameId: user?.profileFrameId ?? null,
            profileBgImage: user?.profileBgImage ?? null,
            profileBgRepeat: user?.profileBgRepeat ?? null,
            profileBgAttachment: user?.profileBgAttachment ?? null,
            profileBgSize: user?.profileBgSize ?? null,
            profileBgPosition: user?.profileBgPosition ?? null,
          }}
          currentAvatar={user?.avatar ?? null}
          oauthImage={oauthImage}
          ageVerified={!!user?.ageVerified}
          showGraphicByDefault={user?.showGraphicByDefault ?? false}
          showNsfwContent={user?.showNsfwContent ?? false}
          emailOnComment={user?.emailOnComment ?? true}
          emailOnNewChat={user?.emailOnNewChat ?? true}
          emailOnMention={user?.emailOnMention ?? true}
          emailOnFriendRequest={user?.emailOnFriendRequest ?? true}
          emailOnSubscribedPost={user?.emailOnSubscribedPost ?? true}
          emailOnTagPost={user?.emailOnTagPost ?? true}
          pushEnabled={user?.pushEnabled ?? false}
          isProfilePublic={user?.isProfilePublic ?? true}
          email={user?.email ?? null}
          pendingEmail={user?.pendingEmail ?? null}
          phoneVerified={!!user?.phoneVerified}
          phoneNumber={user?.phoneNumber ?? null}
          isCredentialsUser={isCredentialsUser}
          isPremium={isPremium}
          stars={user?.stars ?? 0}
          backgrounds={backgrounds}
          userEmail={user?.email ?? null}
        />

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
  );
}
