import { Resend } from "resend";
import * as Sentry from "@sentry/nextjs";

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
}

export async function sendNewChatEmail(params: {
  toEmail: string;
  senderName: string;
  conversationId: string;
}) {
  const { toEmail, senderName, conversationId } = params;
  const chatUrl = `${getBaseUrl()}/chat/${conversationId}`;

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
}

export async function sendPasswordResetEmail(params: {
  toEmail: string;
  token: string;
}) {
  const { toEmail, token } = params;
  const resetUrl = `${getBaseUrl()}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(toEmail)}`;

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: "Reset your password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #18181b; margin-bottom: 16px;">Reset your password</h2>
          <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
            We received a request to reset your password. Click the button below to choose a new one.
          </p>
          <a href="${resetUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #18181b; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">
            Reset Password
          </a>
          <p style="color: #a1a1aa; font-size: 12px; margin-top: 32px;">
            This link will expire in 1 hour. If you didn&apos;t request this, you can safely ignore this email.
          </p>
        </div>
      `,
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { emailType: "password-reset", toEmail },
    });
  }
}

export async function sendWelcomeEmail(toEmail: string) {
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: "Welcome to the party! \u{1F389}",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #18181b; margin-bottom: 16px;">Welcome to the party! \u{1F389}</h2>
        <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
          I hope you'll find your time on VibrantSocial more enriching than your average social media. No algorithms, no children, just self expression.
        </p>
        <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
          Please let me know by messaging me on the app, or emailing <a href="mailto:vibrantsocial@proton.me" style="color: #18181b;">vibrantsocial@proton.me</a>.
        </p>
        <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
          Thanks for joining us.<br/>
          &mdash; Theresa Anna
        </p>
        <a href="${getBaseUrl()}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #18181b; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">
          Get Started
        </a>
      </div>
    `,
  });
}

export async function sendEmailVerificationEmail(params: {
  toEmail: string;
  token: string;
}) {
  const { toEmail, token } = params;
  const verifyUrl = `${getBaseUrl()}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(toEmail)}`;

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: "Verify your email address",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #18181b; margin-bottom: 16px;">Verify your email address</h2>
          <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
            Click the button below to verify this email address for your VibrantSocial account.
          </p>
          <a href="${verifyUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #18181b; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">
            Verify Email
          </a>
          <p style="color: #a1a1aa; font-size: 12px; margin-top: 32px;">
            This link will expire in 1 hour. If you didn&apos;t request this, you can safely ignore this email.
          </p>
        </div>
      `,
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { emailType: "email-verification", toEmail },
    });
  }
}

export async function sendMentionEmail(params: {
  toEmail: string;
  mentionerName: string;
  postId: string;
  commentId?: string;
}) {
  const { toEmail, mentionerName, postId, commentId } = params;
  const postUrl = commentId
    ? `${getBaseUrl()}/post/${postId}?commentId=${commentId}`
    : `${getBaseUrl()}/post/${postId}`;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: "Someone mentioned you!",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #18181b; margin-bottom: 16px;">Hey, friend!</h2>
        <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
          <strong>${escapeHtml(mentionerName)}</strong> mentioned you in a ${commentId ? "comment" : "post"}. You might wanna check that out!
        </p>
        <a href="${postUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #18181b; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">
          View ${commentId ? "Comment" : "Post"}
        </a>
        <p style="color: #a1a1aa; font-size: 12px; margin-top: 32px;">
          You can turn off email notifications in your <a href="${getBaseUrl()}/profile" style="color: #a1a1aa;">profile settings</a>.
        </p>
      </div>
    `,
  });
}

export async function sendFriendRequestEmail(params: {
  toEmail: string;
  senderName: string;
}) {
  const { toEmail, senderName } = params;
  const friendRequestsUrl = `${getBaseUrl()}/friend-requests`;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: `${escapeHtml(senderName)} sent you a friend request!`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #18181b; margin-bottom: 16px;">New Friend Request</h2>
        <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
          <strong>${escapeHtml(senderName)}</strong> sent you a friend request! Head over to VibrantSocial to accept or decline.
        </p>
        <a href="${friendRequestsUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #d946ef; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
          View Friend Requests
        </a>
        <p style="color: #a1a1aa; font-size: 12px; margin-top: 32px;">
          You can turn off email notifications in your <a href="${getBaseUrl()}/profile" style="color: #a1a1aa;">profile settings</a>.
        </p>
      </div>
    `,
  });
}

export async function sendNewPostEmail(params: {
  toEmail: string;
  authorName: string;
  postId: string;
}) {
  const { toEmail, authorName, postId } = params;
  const postUrl = `${getBaseUrl()}/post/${postId}`;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: `${escapeHtml(authorName)} just posted!`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #18181b; margin-bottom: 16px;">Hey, friend!</h2>
        <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
          <strong>${escapeHtml(authorName)}</strong> published a new post. You might wanna check that out!
        </p>
        <a href="${postUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #18181b; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">
          View Post
        </a>
        <p style="color: #a1a1aa; font-size: 12px; margin-top: 32px;">
          You can turn off email notifications in your <a href="${getBaseUrl()}/profile" style="color: #a1a1aa;">profile settings</a>.
        </p>
      </div>
    `,
  });
}

export async function sendTagPostEmail(params: {
  toEmail: string;
  authorName: string;
  postId: string;
  tagNames: string[];
}) {
  const { toEmail, authorName, postId, tagNames } = params;
  const postUrl = `${getBaseUrl()}/post/${postId}`;
  const tagList = tagNames.map((t) => `#${escapeHtml(t)}`).join(", ");

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: `New post in ${tagNames.map((t) => "#" + t).join(", ")}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #18181b; margin-bottom: 16px;">Hey, friend!</h2>
        <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
          <strong>${escapeHtml(authorName)}</strong> posted in ${tagList}. You might wanna check that out!
        </p>
        <a href="${postUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #18181b; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">
          View Post
        </a>
        <p style="color: #a1a1aa; font-size: 12px; margin-top: 32px;">
          You can turn off email notifications in your <a href="${getBaseUrl()}/profile" style="color: #a1a1aa;">profile settings</a>.
        </p>
      </div>
    `,
  });
}

export async function sendTagDigestEmail(params: {
  toEmail: string;
  posts: Array<{ postId: string; authorName: string; tagNames: string[] }>;
}) {
  const { toEmail, posts } = params;
  const baseUrl = getBaseUrl();

  const postItems = posts
    .map((p) => {
      const postUrl = `${baseUrl}/post/${p.postId}`;
      const tagList = p.tagNames.map((t) => `#${escapeHtml(t)}`).join(", ");
      return `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
            <p style="color: #3f3f46; font-size: 14px; margin: 0;">
              <strong>${escapeHtml(p.authorName)}</strong> posted in ${tagList}
            </p>
            <a href="${postUrl}" style="color: #18181b; font-size: 13px; margin-top: 4px; display: inline-block;">View Post &rarr;</a>
          </td>
        </tr>
      `;
    })
    .join("");

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: `Your daily tag digest — ${posts.length} new ${posts.length === 1 ? "post" : "posts"}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #18181b; margin-bottom: 16px;">Your daily tag digest</h2>
        <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
          Here's what happened in the tags you follow:
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          ${postItems}
        </table>
        <p style="color: #a1a1aa; font-size: 12px; margin-top: 32px;">
          You can turn off email notifications in your <a href="${baseUrl}/profile" style="color: #a1a1aa;">profile settings</a>.
        </p>
      </div>
    `,
  });
}

export async function sendReportEmail(params: {
  reporterUsername: string;
  reporterEmail: string;
  contentType: "post" | "comment" | "profile";
  contentId: string;
  contentPreview: string;
  description: string;
}) {
  const { reporterUsername, reporterEmail, contentType, contentId, contentPreview, description } = params;
  const baseUrl = getBaseUrl();

  let contentUrl = baseUrl;
  if (contentType === "post") {
    contentUrl = `${baseUrl}/post/${contentId}`;
  } else if (contentType === "comment") {
    contentUrl = `${baseUrl}/post/${contentId}`;
  } else if (contentType === "profile") {
    contentUrl = `${baseUrl}/${contentPreview}`;
  }

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: "vibrantsocial@proton.me",
      subject: `Content Report: ${contentType} — ${contentId}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #18181b; margin-bottom: 16px;">Content Report</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #71717a; font-size: 14px; vertical-align: top; width: 120px;">Reporter</td>
              <td style="padding: 8px 0; color: #18181b; font-size: 14px;">${escapeHtml(reporterUsername)} (${escapeHtml(reporterEmail)})</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #71717a; font-size: 14px; vertical-align: top;">Content Type</td>
              <td style="padding: 8px 0; color: #18181b; font-size: 14px;">${escapeHtml(contentType)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #71717a; font-size: 14px; vertical-align: top;">Content ID</td>
              <td style="padding: 8px 0; color: #18181b; font-size: 14px;">${escapeHtml(contentId)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #71717a; font-size: 14px; vertical-align: top;">Preview</td>
              <td style="padding: 8px 0; color: #18181b; font-size: 14px;">${escapeHtml(contentPreview)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #71717a; font-size: 14px; vertical-align: top;">Description</td>
              <td style="padding: 8px 0; color: #18181b; font-size: 14px;">${escapeHtml(description)}</td>
            </tr>
          </table>
          <a href="${contentUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #18181b; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">
            View Reported Content
          </a>
          <p style="color: #a1a1aa; font-size: 12px; margin-top: 32px;">
            Reported at ${new Date().toISOString()}
          </p>
        </div>
      `,
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { emailType: "report", contentType, contentId, reporterUsername },
    });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
