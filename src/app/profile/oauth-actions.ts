"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAuthWithRateLimit, isActionError } from "@/lib/action-utils";
import type { ActionState } from "@/lib/action-utils";
import { revalidatePath } from "next/cache";

// -------------------------------------------------------------------------
// Self-service OAuth account management for `/profile`.
//
// DISTINCT from `account-linking-actions.ts` — that file is about
// multi-*user* groups (the account-switcher feature), not NextAuth OAuth
// `Account` rows. Keeping these actions separate avoids conflating the
// two "linked" concepts.
// -------------------------------------------------------------------------

export interface OAuthConnection {
  id: string;
  provider: string;
  providerAccountId: string;
}

export interface OAuthConnectionsPayload {
  connections: OAuthConnection[];
  hasPassword: boolean;
}

/**
 * Current viewer's OAuth connections, plus whether they have a password
 * set. The `hasPassword` flag is how the client decides whether an
 * unlink button is safe to show — the last remaining sign-in method can
 * never be unlinked (server enforces the same rule, client disables
 * the button so users don't waste a click).
 */
export async function getMyOAuthConnections(): Promise<OAuthConnectionsPayload> {
  const session = await auth();
  if (!session?.user?.id) {
    return { connections: [], hasPassword: false };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      passwordHash: true,
      accounts: {
        select: { id: true, provider: true, providerAccountId: true },
        // NextAuth's `Account` has no createdAt; cuid order is roughly
        // chronological so this gives us a stable link order.
        orderBy: { id: "asc" },
      },
    },
  });
  if (!user) return { connections: [], hasPassword: false };

  return {
    connections: user.accounts,
    hasPassword: user.passwordHash !== null,
  };
}

/**
 * Remove one of the viewer's OAuth `Account` rows.
 *
 * Guardrail (identical to the admin version in `admin/actions.ts`):
 * refuses if doing so leaves the user with no way to sign in — no
 * other OAuth account AND no password. The client also shows a
 * disabled / "only sign-in" badge in that case, but the server is the
 * source of truth.
 *
 * Mobile note: mobile JWTs are tied to the User, not the Account, so
 * an active mobile session keeps working until its token naturally
 * expires. The user simply can't re-authenticate via that provider.
 */
export async function unlinkMyOAuthAccount(
  formData: FormData,
): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("profile");
  if (isActionError(result)) return result;
  const session = result;

  const accountId = (formData.get("accountId") as string | null)?.trim();
  if (!accountId) return { success: false, message: "Missing account id" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      passwordHash: true,
      accounts: { select: { id: true, provider: true } },
    },
  });
  if (!user) return { success: false, message: "User not found" };

  const account = user.accounts.find((a) => a.id === accountId);
  if (!account) {
    return { success: false, message: "That connection is not on your account" };
  }

  const otherAccounts = user.accounts.filter((a) => a.id !== accountId);
  const hasPassword = user.passwordHash !== null;
  if (otherAccounts.length === 0 && !hasPassword) {
    return {
      success: false,
      message:
        "You can't unlink your only sign-in method. Set a password first, " +
        "or connect another provider.",
    };
  }

  await prisma.account.delete({ where: { id: accountId } });
  revalidatePath("/profile");

  return {
    success: true,
    message: `Disconnected ${account.provider}.`,
  };
}
