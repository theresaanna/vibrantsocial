"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { SpotlightUser } from "./spotlight-actions";
import { FramedAvatar } from "@/components/framed-avatar";
import { StyledName } from "@/components/styled-name";
import { BioContent } from "@/components/bio-content";
import { rpc } from "@/lib/rpc";

function SpotlightCard({ user }: { user: SpotlightUser }) {
  const avatarSrc = user.avatar || user.image;
  const displayName = user.displayName || user.name || user.username || "User";
  const href = user.username ? `/${user.username}` : "#";

  const hasTheme = !!(
    user.profileBgColor ||
    user.profileTextColor ||
    user.profileLinkColor ||
    user.profileSecondaryColor ||
    user.profileContainerColor
  );

  const themeVars = hasTheme
    ? ({
        "--profile-bg": user.profileBgColor ?? "#ffffff",
        "--profile-text": user.profileTextColor ?? "#18181b",
        "--profile-link": user.profileLinkColor ?? "#2563eb",
        "--profile-secondary": user.profileSecondaryColor ?? "#71717a",
        "--profile-container": user.profileContainerColor ?? "#f4f4f5",
        "--profile-container-alpha": `${user.profileContainerOpacity ?? 100}%`,
      } as React.CSSProperties)
    : {};

  const bgImageStyle = user.profileBgImage
    ? {
        backgroundImage: `url(${user.profileBgImage})`,
        backgroundRepeat: user.profileBgRepeat ?? "no-repeat",
        backgroundSize: "cover",
        backgroundPosition: user.profileBgPosition ?? "center",
      }
    : {};

  return (
    <Link href={href} className="block">
      <div
        className={`overflow-hidden rounded-xl shadow-md transition-shadow hover:shadow-lg ${hasTheme ? "profile-themed" : ""}`}
        style={{
          ...themeVars,
          ...bgImageStyle,
          minHeight: "auto",
        }}
      >
        <div className="rounded-xl bg-white p-5 dark:bg-zinc-900">
          <div className="flex items-start gap-3">
            <FramedAvatar
              src={avatarSrc}
              alt={displayName}
              initial={displayName[0]?.toUpperCase()}
              size={56}
              frameId={user.profileFrameId}
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                <StyledName fontId={user.usernameFont} ageVerified={!!user.ageVerified}>
                  {displayName}
                </StyledName>
              </h3>
              {user.username && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  @{user.username}
                </p>
              )}
            </div>
          </div>

          {user.bio && (
            <div className="mt-2 max-h-40 overflow-hidden">
              <BioContent content={user.bio} />
            </div>
          )}

          <div className="mt-3 flex gap-4 text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {user._count.posts}
              </span>{" "}
              {user._count.posts === 1 ? "post" : "posts"}
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {user._count.followers}
              </span>{" "}
              {user._count.followers === 1 ? "follower" : "followers"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function CommunitiesSpotlightClient() {
  const [users, setUsers] = useState<SpotlightUser[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await rpc<SpotlightUser[]>("fetchSpotlightUsers");
      setUsers(result);
    });
  }, []);

  if (users === null || isPending) {
    return (
      <div className="mt-6 flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-lg dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">No spotlight profiles yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="spotlight-list">
      {users.map((user) => (
        <SpotlightCard key={user.id} user={user} />
      ))}
    </div>
  );
}
