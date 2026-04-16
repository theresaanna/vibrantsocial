"use server";

import { prisma } from "@/lib/prisma";

const SPOTLIGHT_USERNAMES = ["WorshipMango", "johniley"];

export type SpotlightUser = {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatar: string | null;
  image: string | null;
  profileFrameId: string | null;
  usernameFont: string | null;
  ageVerified?: Date | null;
  bio: string | null;
  profileBgColor: string | null;
  profileTextColor: string | null;
  profileLinkColor: string | null;
  profileSecondaryColor: string | null;
  profileContainerColor: string | null;
  profileContainerOpacity: number | null;
  profileBgImage: string | null;
  profileBgRepeat: string | null;
  profileBgSize: string | null;
  profileBgPosition: string | null;
  _count: { followers: number; posts: number };
};

export async function fetchSpotlightUsers(): Promise<SpotlightUser[]> {
  const users = await prisma.user.findMany({
    where: { username: { in: SPOTLIGHT_USERNAMES, mode: "insensitive" } },
    select: {
      id: true,
      username: true,
      displayName: true,
      name: true,
      avatar: true,
      image: true,
      profileFrameId: true,
      usernameFont: true,
      ageVerified: true,
      bio: true,
      profileBgColor: true,
      profileTextColor: true,
      profileLinkColor: true,
      profileSecondaryColor: true,
      profileContainerColor: true,
      profileContainerOpacity: true,
      profileBgImage: true,
      profileBgRepeat: true,
      profileBgSize: true,
      profileBgPosition: true,
      _count: { select: { followers: true, posts: true } },
    },
  });

  // Preserve the order defined in SPOTLIGHT_USERNAMES
  return SPOTLIGHT_USERNAMES.flatMap((uname) => {
    const user = users.find((u: { username: string | null }) => u.username?.toLowerCase() === uname.toLowerCase());
    return user ? [user] : [];
  });
}
