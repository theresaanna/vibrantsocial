import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

let resend: Resend;
function getResend(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.SUPPORT_EMAIL_WEBHOOK_SECRET;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { from, to, subject, raw } = await request.json();

  // Forward the support email to your personal address
  await getResend().emails.send({
    from: "VibrantSocial Support <support@vibrantsocial.app>",
    to: "theresa@vibrantsocial.app",
    subject: `[Support] ${subject}`,
    text: `From: ${from}\nTo: ${to}\nSubject: ${subject}\n\n---\n\n${raw}`,
  });

  return NextResponse.json({ ok: true });
}
