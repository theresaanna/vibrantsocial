import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Discord from "next-auth/providers/discord";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { autoFriendNewUser } from "@/lib/auto-friend";
import { inngest } from "@/lib/inngest";

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
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.displayName = user.displayName;
        token.bio = user.bio;
        token.avatar = user.avatar;
        token.tier = user.tier ?? "free";
      }

      if (trigger === "update" && session) {
        token.username = session.user.username;
        token.displayName = session.user.displayName;
        token.bio = session.user.bio;
        token.avatar = session.user.avatar;
        if (session.user.tier) token.tier = session.user.tier;
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
      return session;
    },
  },
});
