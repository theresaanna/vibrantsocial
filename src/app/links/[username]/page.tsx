import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { userThemeSelect, buildUserTheme } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";
import { FramedAvatar } from "@/components/framed-avatar";
import { StyledName } from "@/components/styled-name";
import { InAppBrowserBreakout } from "./in-app-browser-breakout";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const user = await prisma.user.findUnique({
    where: { username },
    select: { displayName: true, name: true, linksPageEnabled: true, linksPageBio: true },
  });

  if (!user || !user.linksPageEnabled) {
    return { title: "Not Found" };
  }

  const displayName = user.displayName || user.name || username;
  return {
    title: `${displayName}'s Links`,
    description: user.linksPageBio || `Links from ${displayName}`,
    robots: { index: true, follow: true },
  };
}

export default async function LinksPage({ params }: Props) {
  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      ...userThemeSelect,
      username: true,
      displayName: true,
      name: true,
      avatar: true,
      image: true,
      profileFrameId: true,
      usernameFont: true,
      linksPageEnabled: true,
      linksPageBio: true,
      linksPageSensitiveLinks: true,
      linksPageLinks: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, url: true },
      },
    },
  });

  if (!user || !user.linksPageEnabled) notFound();

  const theme = buildUserTheme(user);
  const displayName = user.displayName || user.name || user.username || "";

  return (
    <ThemedPage {...theme} bare>
      <div className="flex min-h-screen flex-col items-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl profile-container px-6 py-8 space-y-6">
          {/* Avatar + Name */}
          <div className="flex flex-col items-center gap-3">
            <FramedAvatar
              src={user.avatar || user.image}
              alt={displayName}
              size={96}
              frameId={user.profileFrameId}
            />
            <h1 className="text-xl font-semibold profile-text">
              <StyledName fontId={user.usernameFont}>{displayName}</StyledName>
            </h1>
          </div>

          {/* Bio */}
          {user.linksPageBio && (
            <p className="text-center text-sm profile-text-secondary whitespace-pre-wrap">
              {user.linksPageBio}
            </p>
          )}

          {/* Links (wrapped for in-app browser breakout) */}
          <InAppBrowserBreakout sensitiveLinks={user.linksPageSensitiveLinks}>
            {user.linksPageLinks.length > 0 && (
              <div className="space-y-3">
                {user.linksPageLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="links-page-btn block w-full rounded-xl profile-container px-4 py-3 text-center font-medium transition-opacity hover:opacity-80"
                    data-testid="links-page-link"
                  >
                    {link.title}
                  </a>
                ))}
              </div>
            )}
          </InAppBrowserBreakout>

          {/* Footer */}
          <div className="pt-2 text-center">
            <a
              href="https://vibrantsocial.app"
              className="text-xs profile-text-secondary transition-opacity hover:opacity-70"
            >
              vibrantsocial.app
            </a>
          </div>
        </div>
      </div>
    </ThemedPage>
  );
}
