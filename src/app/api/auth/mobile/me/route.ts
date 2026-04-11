import { getSessionFromRequest } from "@/lib/mobile-auth";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return corsJson(req, { error: "Not authenticated" }, { status: 401 });
  }

  return corsJson(req, {
    user: {
      id: session.user.id,
      username: session.user.username,
      displayName: session.user.displayName,
      email: session.user.email,
      avatar: session.user.avatar,
      tier: session.user.tier ?? "free",
    },
  });
}
