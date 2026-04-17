import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import {
  resolveUserTheme,
  themeResolverUserSelect,
} from "@/lib/theme-resolver";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

/**
 * Public endpoint: returns a user's resolved theme in the canonical
 * platform-agnostic wire format. Consumed by the web app and the mobile
 * client — the shape is versioned so both platforms can evolve together.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { username: true, ...themeResolverUserSelect },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404, headers: corsHeaders(req) },
    );
  }

  const assetBaseUrl = new URL(req.url).origin;
  const theme = resolveUserTheme(user, { assetBaseUrl });

  return NextResponse.json(
    { username: user.username, theme },
    {
      headers: {
        ...corsHeaders(req),
        "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
