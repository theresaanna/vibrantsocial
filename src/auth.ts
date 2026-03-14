import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Discord from "next-auth/providers/discord";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { autoFriendNewUser } from "@/lib/auto-friend";
import { inngest } from "@/lib/inngest";
import type { LinkedAccount } from "@/types/next-auth";

async function loadLinkedAccounts(
  userId: string
): Promise<LinkedAccount[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { linkedAccountGroupId: true },
  });

  if (!user?.linkedAccountGroupId) return [];

  const members = await prisma.user.findMany({
    where: {
      linkedAccountGroupId: user.linkedAccountGroupId,
      id: { not: userId },
    },
    select: { id: true, username: true, displayName: true, avatar: true },
  });

  return members;
}

async function linkUsersInGroup(userIdA: string, userIdB: string) {
  const [userA, userB] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userIdA },
      select: { linkedAccountGroupId: true },
    }),
    prisma.user.findUnique({
      where: { id: userIdB },
      select: { linkedAccountGroupId: true },
    }),
  ]);

  if (!userA || !userB) return;

  const groupA = userA.linkedAccountGroupId;
  const groupB = userB.linkedAccountGroupId;

  // Already in the same group
  if (groupA && groupA === groupB) return;

  if (!groupA && !groupB) {
    const group = await prisma.linkedAccountGroup.create({ data: {} });
    await prisma.user.updateMany({
      where: { id: { in: [userIdA, userIdB] } },
      data: { linkedAccountGroupId: group.id },
    });
  } else if (groupA && !groupB) {
    await prisma.user.update({
      where: { id: userIdB },
      data: { linkedAccountGroupId: groupA },
    });
  } else if (!groupA && groupB) {
    await prisma.user.update({
      where: { id: userIdA },
      data: { linkedAccountGroupId: groupB },
    });
  } else if (groupA && groupB) {
    await prisma.user.updateMany({
      where: { linkedAccountGroupId: groupB },
      data: { linkedAccountGroupId: groupA },
    });
    await prisma.linkedAccountGroup.delete({ where: { id: groupB } });
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({ allowDangerousEmailAccountLinking: true }),
    Discord({ allowDangerousEmailAccountLinking: true }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
          avatar: user.avatar,
          tier: user.tier ?? "free",
          isEmailVerified: !!user.emailVerified,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  events: {
    async createUser({ user }) {
      if (user.id) {
        await autoFriendNewUser(user.id);
      }
      if (user.email) {
        await inngest.send({
          name: "email/welcome",
          data: { toEmail: user.email },
        });
      }
    },
  },
  callbacks: {
    async jwt({ token, user, trigger, session, account }) {
      if (user) {
        // Check for OAuth account-linking flow (cookie set by startOAuthLink)
        let isLinkingFlow = false;
        let linkCookieValue: string | undefined;
        try {
          const cookieStore = await cookies();
          linkCookieValue = cookieStore.get("linkFromUserId")?.value;
        } catch {
          // cookies() may throw in non-request contexts; ignore
        }

        if (linkCookieValue && linkCookieValue !== user.id) {
          // OAuth linking flow: link the two users and keep the original session
          const originalUser = await prisma.user.findUnique({
            where: { id: linkCookieValue },
            select: {
              id: true,
              username: true,
              displayName: true,
              bio: true,
              avatar: true,
              tier: true,
              emailVerified: true,
            },
          });

          if (originalUser) {
            await linkUsersInGroup(linkCookieValue, user.id!);

            // Set token to the ORIGINAL user, not the OAuth user
            token.id = originalUser.id;
            token.username = originalUser.username;
            token.displayName = originalUser.displayName;
            token.bio = originalUser.bio;
            token.avatar = originalUser.avatar;
            token.tier = originalUser.tier ?? "free";
            token.isEmailVerified = !!originalUser.emailVerified;
            token.authProvider = account?.provider ?? null;
            token.linkedAccounts = await loadLinkedAccounts(originalUser.id);
            isLinkingFlow = true;
          }

          // Clean up the cookie (best-effort; may silently fail in GET context,
          // but it expires in 5 minutes anyway)
          try {
            const cookieStore = await cookies();
            cookieStore.delete("linkFromUserId");
          } catch {
            // Ignore — cookie will expire naturally
          }
        } else if (linkCookieValue) {
          // Cookie user === OAuth user (self-link), just clear it
          try {
            const cookieStore = await cookies();
            cookieStore.delete("linkFromUserId");
          } catch {
            // Ignore — cookie will expire naturally
          }
        }

        if (!isLinkingFlow) {
          token.id = user.id;
          token.username = user.username;
          token.displayName = user.displayName;
          token.bio = user.bio;
          token.avatar = user.avatar;
          token.tier = user.tier ?? "free";
          token.authProvider = account?.provider ?? null;
          // OAuth providers (Google, Discord) verify email themselves
          if (account?.provider && account.provider !== "credentials") {
            token.isEmailVerified = true;
            // Backfill emailVerified in DB for linked accounts
            if (user.id && !("emailVerified" in user && user.emailVerified)) {
              prisma.user
                .update({
                  where: { id: user.id },
                  data: { emailVerified: new Date() },
                })
                .catch(() => {});
            }
          } else {
            token.isEmailVerified =
              user.isEmailVerified ??
              !!("emailVerified" in user && user.emailVerified);
          }

          // Load linked accounts on sign-in
          token.linkedAccounts = await loadLinkedAccounts(user.id!);
        }
      }

      if (trigger === "update" && session) {
        // Handle account switching
        if (session.switchToUserId) {
          const targetUserId = session.switchToUserId as string;

          // Verify group membership server-side
          const currentUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { linkedAccountGroupId: true },
          });

          const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: {
              id: true,
              username: true,
              displayName: true,
              bio: true,
              avatar: true,
              tier: true,
              emailVerified: true,
              linkedAccountGroupId: true,
            },
          });

          if (
            currentUser?.linkedAccountGroupId &&
            targetUser?.linkedAccountGroupId === currentUser.linkedAccountGroupId
          ) {
            // Swap JWT to target user
            token.id = targetUser.id;
            token.username = targetUser.username;
            token.displayName = targetUser.displayName;
            token.bio = targetUser.bio;
            token.avatar = targetUser.avatar;
            token.tier = targetUser.tier ?? "free";
            token.isEmailVerified = !!targetUser.emailVerified;

            // Reload linked accounts for the new active user
            token.linkedAccounts = await loadLinkedAccounts(targetUser.id);
          }
        } else {
          // Normal session update (profile changes)
          if (session.user?.username !== undefined)
            token.username = session.user.username;
          if (session.user?.displayName !== undefined)
            token.displayName = session.user.displayName;
          if (session.user?.bio !== undefined)
            token.bio = session.user.bio;
          if (session.user?.avatar !== undefined)
            token.avatar = session.user.avatar;
          if (session.user?.tier) token.tier = session.user.tier;
          if (session.user?.isEmailVerified !== undefined)
            token.isEmailVerified = session.user.isEmailVerified;

          // Refresh linked accounts if requested
          if (session.refreshLinkedAccounts) {
            token.linkedAccounts = await loadLinkedAccounts(token.id as string);
          }
        }
      }

      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.username = (token.username as string) ?? null;
      session.user.displayName = (token.displayName as string) ?? null;
      session.user.bio = (token.bio as string) ?? null;
      session.user.avatar = (token.avatar as string) ?? null;
      session.user.tier = (token.tier as string) ?? "free";
      session.user.isEmailVerified =
        (token.isEmailVerified as boolean) ?? false;
      session.user.authProvider = (token.authProvider as string) ?? null;
      session.user.linkedAccounts =
        (token.linkedAccounts as LinkedAccount[]) ?? [];
      return session;
    },
  },
});
