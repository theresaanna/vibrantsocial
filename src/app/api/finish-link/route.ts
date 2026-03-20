import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { linkUsersInGroup, loadLinkedAccounts } from "@/lib/account-linking-db";

/**
 * Account-linking handler that runs AFTER the OAuth callback completes.
 *
 * Has guaranteed access to request cookies via `req.cookies` (unlike
 * NextAuth callbacks where `cookies()` from `next/headers` can fail).
 *
 * Handles two cases:
 * 1. Different email: OAuth created a new user → link the two users
 * 2. Same email: OAuth auto-linked Account to existing user → split into
 *    a separate user for account switching
 */
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const provider = req.nextUrl.searchParams.get("provider");
  const linkCookie = req.cookies.get("linkFromUserId")?.value;

  // Security: the URL param must match the httpOnly cookie
  if (!from || from !== linkCookie) {
    console.error("[finish-link] Security check failed: from/cookie mismatch");
    const res = NextResponse.redirect(new URL("/profile", req.url));
    if (linkCookie) res.cookies.delete("linkFromUserId");
    res.cookies.delete("linkRedirect");
    return res;
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const oauthUserId = session.user.id;
  const redirectUrl = new URL("/profile", req.url);

  if (from !== oauthUserId) {
    // ── Different-email case ──
    // OAuth created a new user with a different email.
    // Link the original user and the OAuth user.
    try {
      await linkUsersInGroup(from, oauthUserId);
    } catch (err) {
      console.error("[finish-link] linking error:", err);
    }
    // Switch the session back to the original user
    redirectUrl.searchParams.set("_switchTo", from);
  } else if (provider) {
    // ── Same-email case ──
    // Auth.js auto-linked the Account to the existing user.
    // Check if the JWT callback already split it into a separate user.
    const existingLinks = await loadLinkedAccounts(from);
    if (existingLinks.length > 0) {
      // Trigger a session refresh so the client picks up the linked accounts
      redirectUrl.searchParams.set("_switchTo", from);
    } else {
      try {
        const allUserAccounts = await prisma.account.findMany({
          where: { userId: from },
        });

        // Find the Account that Auth.js just linked to the current user
        const account = allUserAccounts.find((a) => a.provider === provider) ?? null;

        if (account) {
          // Fetch display info from the OAuth provider
          let displayName: string | null = null;
          let avatarUrl: string | null = null;

          if (provider === "discord" && account.access_token) {
            try {
              const res = await fetch("https://discord.com/api/users/@me", {
                headers: { Authorization: `Bearer ${account.access_token}` },
              });
              if (res.ok) {
                const profile = await res.json();
                displayName = profile.global_name ?? profile.username ?? null;
                if (profile.avatar) {
                  avatarUrl = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`;
                }
              }
            } catch {
              // Fall back to generic name
            }
          } else if (provider === "google" && account.access_token) {
            try {
              const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
                headers: { Authorization: `Bearer ${account.access_token}` },
              });
              if (res.ok) {
                const profile = await res.json();
                displayName = profile.name ?? null;
                avatarUrl = profile.picture ?? null;
              }
            } catch {
              // Fall back to generic name
            }
          }

          if (!displayName) {
            displayName = `${provider.charAt(0).toUpperCase() + provider.slice(1)} Account`;
          }

          // Create a new user for this OAuth identity
          const newUser = await prisma.user.create({
            data: {
              displayName,
              name: displayName,
              image: avatarUrl,
              avatar: avatarUrl,
              emailVerified: new Date(),
            },
          });

          // Move the Account from the current user to the new user
          await prisma.account.update({
            where: { id: account.id },
            data: { userId: newUser.id },
          });

          // Link both users in a group
          await linkUsersInGroup(from, newUser.id);

          // Trigger session refresh to pick up the new linked account
          redirectUrl.searchParams.set("_switchTo", from);
        }
      } catch (err) {
        console.error("[finish-link] Same-email splitting error:", err);
      }
    }
  }

  const res = NextResponse.redirect(redirectUrl);
  res.cookies.delete("linkFromUserId");
  res.cookies.delete("linkRedirect");
  return res;
}
