import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string | null;
      displayName: string | null;
      bio: string | null;
      avatar: string | null;
      tier: string;
      isEmailVerified: boolean;
      authProvider: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    username: string | null;
    displayName: string | null;
    bio: string | null;
    avatar: string | null;
    tier: string;
    isEmailVerified: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string | null;
    displayName: string | null;
    bio: string | null;
    avatar: string | null;
    tier: string;
    isEmailVerified: boolean;
    authProvider: string | null;
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    username: string | null;
    displayName: string | null;
    bio: string | null;
    avatar: string | null;
    tier: string;
    isEmailVerified: boolean;
  }
}
