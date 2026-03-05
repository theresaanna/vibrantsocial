import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string | null;
      displayName: string | null;
      bio: string | null;
      avatar: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    username: string | null;
    displayName: string | null;
    bio: string | null;
    avatar: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string | null;
    displayName: string | null;
    bio: string | null;
    avatar: string | null;
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    username: string | null;
    displayName: string | null;
    bio: string | null;
    avatar: string | null;
  }
}
