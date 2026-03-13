import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      username: string | null;
      displayName: string | null;
      bio: string | null;
      avatar: string | null;
      tier: string;
      emailVerified: boolean;
    };
  }

  interface User {
    username: string | null;
    displayName: string | null;
    bio: string | null;
    avatar: string | null;
    tier: string;
    emailVerified: boolean;
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
    emailVerified: boolean;
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    username: string | null;
    displayName: string | null;
    bio: string | null;
    avatar: string | null;
    tier: string;
    emailVerified: boolean;
  }
}
