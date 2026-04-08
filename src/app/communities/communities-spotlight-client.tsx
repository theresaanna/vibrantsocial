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

  const bgColor = user.profileBgColor || "#ffffff";
  const textColor = user.profileTextColor || "#18181b";
  const secondaryColor = user.profileSecondaryColor || "#71717a";
  const containerColor = user.profileContainerColor || "#f4f4f5";
  const linkColor = user.profileLinkColor || "#2563eb";
  const containerOpacity = user.profileContainerOpacity ?? 100;

  const hasTheme = !!(
    user.profileBgColor ||
    user.profileTextColor ||
    user.profileLinkColor ||
    user.profileSecondaryColor ||
    user.profileContainerColor
  );

  const bgImageStyle = user.profileBgImage
    ? {
        backgroundImage: `url(${user.profileBgImage})`,
        backgroundRepeat: user.profileBgRepeat ?? "no-repeat",
        backgroundSize: user.profileBgSize ?? "cover",
        backgroundPosition: user.profileBgPosition ?? "center",
      }
    : {};

  return (
    <Link href={href} className="block">
      <div
        className="overflow-hidden rounded-xl shadow-md transition-shadow hover:shadow-lg"
        style={{
          backgroundColor: bgColor,
          ...bgImageStyle,
        }}
      >
        <div
          className="rounded-xl p-5"
          style={{
            backgroundColor: hasTheme
              ? `color-mix(in srgb, ${containerColor} ${containerOpacity}%, transparent)`
              : containerColor,
          }}
        >
          <div className="flex items-start gap-3">
            <FramedAvatar
              src={avatarSrc}
              alt={displayName}
              initial={displayName[0]?.toUpperCase()}
              size={56}
              frameId={user.profileFrameId}
            />
            <div className="min-w-0 flex-1">
              <h3
                className="text-lg font-bold"
                style={{ color: textColor }}
              >
                <StyledName fontId={user.usernameFont}>
                  {displayName}
                </StyledName>
              </h3>
              {user.username && (
                <p className="text-sm" style={{ color: secondaryColor }}>
                  @{user.username}
                </p>
              )}
            </div>
          </div>

          {user.bio && (
            <div
              className="mt-3 max-h-40 overflow-hidden text-sm [&_a]:underline"
              style={{
                color: textColor,
                "--profile-link": linkColor,
              } as React.CSSProperties}
            >
              <BioContent content={user.bio} />
            </div>
          )}

          <div className="mt-3 flex gap-4 text-sm">
            <span style={{ color: secondaryColor }}>
              <span className="font-semibold" style={{ color: textColor }}>
                {user._count.posts}
              </span>{" "}
              {user._count.posts === 1 ? "post" : "posts"}
            </span>
            <span style={{ color: secondaryColor }}>
              <span className="font-semibold" style={{ color: textColor }}>
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
