import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isProfileIncomplete } from "@/lib/require-profile";
import { ThemeForm } from "./theme-form";
import { getProfileBackgrounds, getPremiumProfileBackgrounds } from "@/lib/profile-backgrounds.server";
import type { CustomPresetData } from "@/lib/profile-themes";

export const metadata: Metadata = {
  title: "Theme & Style",
  robots: { index: false, follow: false },
};

export default async function ThemePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      username: true,
      displayName: true,
      bio: true,
      avatar: true,
      image: true,
      tier: true,
      email: true,
      dateOfBirth: true,
      usernameFont: true,
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
      sparklefallEnabled: true,
      sparklefallPreset: true,
      sparklefallSparkles: true,
      sparklefallColors: true,
      sparklefallInterval: true,
      sparklefallWind: true,
      sparklefallMaxSparkles: true,
      sparklefallMinSize: true,
      sparklefallMaxSize: true,
    },
  });

  if (!user || isProfileIncomplete(user)) redirect("/complete-profile");

  const isPremium = user.tier === "premium";
  const avatarSrc = user.avatar ?? user.image ?? session.user.image ?? null;
  const backgrounds = getProfileBackgrounds();
  const premiumBackgrounds = getPremiumProfileBackgrounds();

  let customPresets: CustomPresetData[] = [];
  if (isPremium) {
    try {
      customPresets = (
        await prisma.customThemePreset.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "asc" },
        })
      ).map((p) => ({
        id: p.id,
        name: p.name,
        prompt: p.prompt,
        light: {
          profileBgColor: p.lightBgColor,
          profileTextColor: p.lightTextColor,
          profileLinkColor: p.lightLinkColor,
          profileSecondaryColor: p.lightSecondaryColor,
          profileContainerColor: p.lightContainerColor,
        },
        dark: {
          profileBgColor: p.darkBgColor,
          profileTextColor: p.darkTextColor,
          profileLinkColor: p.darkLinkColor,
          profileSecondaryColor: p.darkSecondaryColor,
          profileContainerColor: p.darkContainerColor,
        },
      }));
    } catch {
      // Table may not exist yet during migration rollout
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
      <div className="w-full max-w-2xl space-y-6 rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-rose-600">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Theme & Style
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Customize your profile appearance
            </p>
          </div>
        </div>

        <ThemeForm
          user={{
            username: user.username,
            displayName: user.displayName,
            bio: user.bio,
            usernameFont: user.usernameFont ?? null,
            profileBgColor: user.profileBgColor ?? null,
            profileTextColor: user.profileTextColor ?? null,
            profileLinkColor: user.profileLinkColor ?? null,
            profileSecondaryColor: user.profileSecondaryColor ?? null,
            profileContainerColor: user.profileContainerColor ?? null,
            profileBgImage: user.profileBgImage ?? null,
            profileBgRepeat: user.profileBgRepeat ?? null,
            profileBgAttachment: user.profileBgAttachment ?? null,
            profileBgSize: user.profileBgSize ?? null,
            profileBgPosition: user.profileBgPosition ?? null,
            sparklefallEnabled: user.sparklefallEnabled ?? false,
            sparklefallPreset: user.sparklefallPreset ?? null,
            sparklefallSparkles: user.sparklefallSparkles ?? null,
            sparklefallColors: user.sparklefallColors ?? null,
            sparklefallInterval: user.sparklefallInterval ?? null,
            sparklefallWind: user.sparklefallWind ?? null,
            sparklefallMaxSparkles: user.sparklefallMaxSparkles ?? null,
            sparklefallMinSize: user.sparklefallMinSize ?? null,
            sparklefallMaxSize: user.sparklefallMaxSize ?? null,
          }}
          avatarSrc={avatarSrc}
          isPremium={isPremium}
          userEmail={user.email ?? null}
          backgrounds={backgrounds}
          premiumBackgrounds={premiumBackgrounds}
          customPresets={customPresets}
        />
      </div>
    </div>
  );
}
