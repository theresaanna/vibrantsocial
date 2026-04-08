import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isProfileIncomplete } from "@/lib/require-profile";
import { ThemeForm } from "./theme-form";
import { getProfileBackgrounds, getPremiumProfileBackgrounds } from "@/lib/profile-backgrounds.server";
import type { CustomPresetData } from "@/lib/profile-themes";
import { userThemeSelect, buildUserTheme } from "@/lib/user-theme";

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
      ...userThemeSelect,
      username: true,
      displayName: true,
      bio: true,
      avatar: true,
      image: true,
      email: true,
      dateOfBirth: true,
      usernameFont: true,
      profileFrameId: true,
      sparklefallPreset: true,
    },
  });

  if (!user || isProfileIncomplete(user)) redirect("/complete-profile");

  const isPremium = user.tier === "premium";
  const avatarSrc = user.avatar ?? user.image ?? session.user.image ?? null;
  const backgrounds = getProfileBackgrounds();
  const premiumBackgrounds = getPremiumProfileBackgrounds();
  const initialTheme = buildUserTheme(user);

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
        profileContainerOpacity: user.profileContainerOpacity ?? 0,
        profileBgImage: user.profileBgImage ?? null,
        profileBgRepeat: user.profileBgRepeat ?? null,
        profileBgAttachment: user.profileBgAttachment ?? null,
        profileBgSize: user.profileBgSize ?? null,
        profileBgPosition: user.profileBgPosition ?? null,
        profileFrameId: user.profileFrameId ?? null,
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
      initialTheme={initialTheme}
    />
  );
}
