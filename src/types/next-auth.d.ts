import { DefaultSession } from "next-auth";

export interface LinkedAccount {
  id: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
}

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
      linkedAccounts: LinkedAccount[];
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
    linkedAccounts: LinkedAccount[];
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
