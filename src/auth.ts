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
import { loadLinkedAccounts } from "@/lib/account-linking-db";
import type { LinkedAccount } from "@/types/next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({}),
    Discord({}),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).trim().toLowerCase();
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        if (user.suspended) return null;

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
          profileFrameId: user.profileFrameId,
          usernameFont: user.usernameFont,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/auth-error",
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
    async signIn({ user }) {
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { suspended: true },
        });
        if (dbUser?.suspended) return "/auth-error?error=Suspended";
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      // If the URL already points to finish-link, let it through unchanged.
      if (url.includes("/api/finish-link")) {
        return url.startsWith("/") ? `${baseUrl}${url}` : url;
      }

      // Only redirect to finish-link when BOTH linkFromUserId AND linkRedirect
      // cookies are present. Both are set atomically by startOAuthLink, so
      // having both confirms this is an intentional account-linking flow —
      // not a stale cookie from an abandoned linking attempt.
      let linkRedirectUrl: string | undefined;
      let linkFromUserId: string | undefined;
      try {
        const cookieStore = await cookies();
        linkFromUserId = cookieStore.get("linkFromUserId")?.value;
        linkRedirectUrl = cookieStore.get("linkRedirect")?.value;
      } catch {
        // cookies() can fail in certain NextAuth callback contexts
      }
      if (linkFromUserId && linkRedirectUrl) {
        return `${baseUrl}${linkRedirectUrl}`;
      }

      // Default redirect behaviour (same as NextAuth's built-in default)
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {}
      return baseUrl;
    },
    async jwt({ token, user, trigger, session, account, profile }) {
      if (user) {
        // Never link accounts in the JWT callback — linking is handled
        // exclusively by /api/finish-link which has proper cookie access
        // and explicit user intent verification.
        token.id = user.id;
        token.username = user.username;
        token.displayName = user.displayName;
        token.bio = user.bio;
        token.avatar = user.avatar;
        token.tier = user.tier ?? "free";
        token.profileFrameId = user.profileFrameId ?? null;
        token.usernameFont = user.usernameFont ?? null;
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
              profileFrameId: true,
              usernameFont: true,
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
            token.profileFrameId = targetUser.profileFrameId;
            token.usernameFont = targetUser.usernameFont;
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
          if (session.user?.profileFrameId !== undefined)
            token.profileFrameId = session.user.profileFrameId;
          if (session.user?.usernameFont !== undefined)
            token.usernameFont = session.user.usernameFont;
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
      session.user.profileFrameId = (token.profileFrameId as string) ?? null;
      session.user.usernameFont = (token.usernameFont as string) ?? null;
      return session;
    },
  },
});
