import { Resend } from "resend";

let resend: Resend;

function getResend(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM_EMAIL = "VibrantSocial <hello@vibrantsocial.app>";

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://vibrantsocial.app"
  );
}

export async function sendCommentEmail(params: {
  toEmail: string;
  commenterName: string;
  postId: string;
}) {
  const { toEmail, commenterName, postId } = params;
  const postUrl = `${getBaseUrl()}/post/${postId}`;

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: "You got a new comment!",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #18181b; margin-bottom: 16px;">Hey, friend!</h2>
          <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
            <strong>${escapeHtml(commenterName)}</strong> left a comment on your post. You might wanna check that out!
          </p>
          <a href="${postUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #18181b; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">
            View Comment
          </a>
          <p style="color: #a1a1aa; font-size: 12px; margin-top: 32px;">
            You can turn off email notifications in your <a href="${getBaseUrl()}/profile" style="color: #a1a1aa;">profile settings</a>.
          </p>
        </div>
      `,
    });
  } catch {
    // Non-critical — don't break the comment flow
  }
}

export async function sendNewChatEmail(params: {
  toEmail: string;
  senderName: string;
  conversationId: string;
}) {
  const { toEmail, senderName, conversationId } = params;
  const chatUrl = `${getBaseUrl()}/chat/${conversationId}`;

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: "You got a new message!",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #18181b; margin-bottom: 16px;">Hey, friend!</h2>
          <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
            <strong>${escapeHtml(senderName)}</strong> sent you a new message. You might wanna check that out!
          </p>
          <a href="${chatUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #18181b; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">
            View Message
          </a>
          <p style="color: #a1a1aa; font-size: 12px; margin-top: 32px;">
            You can turn off email notifications in your <a href="${getBaseUrl()}/profile" style="color: #a1a1aa;">profile settings</a>.
          </p>
        </div>
      `,
    });
  } catch {
    // Non-critical — don't break the chat flow
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
