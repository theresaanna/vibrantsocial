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

export async function sendSubscribedCommentEmail(params: {
  toEmail: string;
  commenterName: string;
  postId: string;
}) {
  const { toEmail, commenterName, postId } = params;
  const postUrl = `${getBaseUrl()}/post/${postId}`;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: "New comment on a post you're subscribed to",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #18181b; margin-bottom: 16px;">Hey, friend!</h2>
        <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
          <strong>${escapeHtml(commenterName)}</strong> commented on a post you're subscribed to.
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
  const chatUrl = `${getBaseUrl()}/messages/${conversationId}`;

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

export async function sendPremiumWelcomeEmail(params: {
  toEmail: string;
}) {
  const { toEmail } = params;
  const baseUrl = getBaseUrl();
  const verifyUrl = `${baseUrl}/age-verify`;

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: "Welcome to Premium!",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #18181b; margin-bottom: 16px;">Welcome to Premium!</h2>
          <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
            Thank you for supporting VibrantSocial! As a premium member, you now have access to custom audiences, exclusive profile frames, and more.
          </p>
          <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
            As a thank you, age verification is <strong>free</strong> for premium members. Use the coupon code below during checkout:
          </p>
          <div style="margin: 20px 0; padding: 16px; background-color: #f4f4f5; border-radius: 8px; text-align: center;">
            <span style="font-size: 20px; font-weight: 700; letter-spacing: 2px; color: #18181b;">FREEVERIFICATION</span>
          </div>
          <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
            Age verification lets you post and view sensitive and graphic/explicit content. Get verified now to unlock the full experience.
          </p>
          <a href="${verifyUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #18181b; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">
            Verify Your Age for Free
          </a>
          <p style="color: #a1a1aa; font-size: 12px; margin-top: 32px;">
            If you have any questions, reach out at <a href="mailto:vibrantsocial@proton.me" style="color: #a1a1aa;">vibrantsocial@proton.me</a>.
          </p>
        </div>
      `,
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { emailType: "premium-welcome", toEmail },
    });
  }
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

export async function sendListJoinRequestEmail(params: {
  toEmail: string;
  requesterName: string;
  listName: string;
}) {
  const { toEmail, requesterName, listName } = params;
  const notificationsUrl = `${getBaseUrl()}/notifications`;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: `${escapeHtml(requesterName)} wants to join your list "${escapeHtml(listName)}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #18181b; margin-bottom: 16px;">New List Join Request</h2>
        <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
          <strong>${escapeHtml(requesterName)}</strong> has requested to join your list <strong>"${escapeHtml(listName)}"</strong>. Head over to VibrantSocial to approve or decline.
        </p>
        <a href="${notificationsUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #d946ef; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
          View Notifications
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
  contentType: "post" | "comment" | "profile" | "conversation";
  contentId: string;
  contentPreview: string;
  description: string;
  category?: string;
}) {
  const { reporterUsername, reporterEmail, contentType, contentId, contentPreview, description, category } = params;
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
      subject: `Content Report: ${category ? category.replace(/_/g, " ") + " — " : ""}${contentType} — ${contentId}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #18181b; margin-bottom: 16px;">Content Report</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #71717a; font-size: 14px; vertical-align: top; width: 120px;">Reporter</td>
              <td style="padding: 8px 0; color: #18181b; font-size: 14px;">${escapeHtml(reporterUsername)} (${escapeHtml(reporterEmail)})</td>
            </tr>
            ${category ? `<tr>
              <td style="padding: 8px 0; color: #71717a; font-size: 14px; vertical-align: top;">Category</td>
              <td style="padding: 8px 0; color: #18181b; font-size: 14px; font-weight: 600;">${escapeHtml(category.replace(/_/g, " "))}</td>
            </tr>` : ""}
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

export async function sendSupportEmail(params: {
  username: string;
  email: string;
  subject: string;
  body: string;
}) {
  const { username, email, subject, body } = params;

  const subjectLabels: Record<string, string> = {
    bug_report: "Bug Report",
    appeal_content_warning: "Appeal Content Warning",
    abuse_report: "Abuse Report",
    feature_request: "Feature Request",
    feedback: "Feedback",
    other: "Other",
  };

  const label = subjectLabels[subject] ?? subject;

  // Call the webhook endpoint directly instead of sending via Resend,
  // because Resend cannot deliver to its own verified domain via MX.
  const webhookUrl = `${getBaseUrl()}/api/webhooks/support-email`;
  const webhookSecret = process.env.SUPPORT_EMAIL_WEBHOOK_SECRET;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${webhookSecret}`,
      },
      body: JSON.stringify({
        from: email,
        to: "support@vibrantsocial.app",
        subject: `[${label}] from @${username}`,
        raw: `From: @${username} (${email})\nSubject: ${label}\n\n${body}`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }
  } catch (error) {
    Sentry.captureException(error, {
      extra: { emailType: "support", username, subject },
    });
  }
}

export async function sendPostDeclinedEmail(params: {
  toEmail: string;
}) {
  const { toEmail } = params;
  const baseUrl = getBaseUrl();
  const verifyUrl = `${baseUrl}/age-verify`;

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: "Your post needs age verification",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #18181b; margin-bottom: 16px;">Your post was declined</h2>
          <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
            Your post was detected as containing graphic or explicit content. Because your account is not age-verified, the post has been removed.
          </p>
          <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
            To post this type of content, please complete age verification first. Once verified, you can repost your content with the appropriate content flag selected.
          </p>
          <a href="${verifyUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #18181b; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">
            Verify Your Age
          </a>
          <p style="color: #a1a1aa; font-size: 12px; margin-top: 32px;">
            Please review the <a href="${baseUrl}" style="color: #a1a1aa;">content guidelines</a> for more information.
          </p>
        </div>
      `,
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { emailType: "post-declined", toEmail },
    });
  }
}

export async function sendContentNoticeEmail(params: {
  toEmail: string;
  postId: string;
  markingLabel: string;
  warningCount: number;
}) {
  const { toEmail, postId, markingLabel, warningCount } = params;
  const baseUrl = getBaseUrl();
  const postUrl = `${baseUrl}/post/${postId}`;

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: "We marked your post for you",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #18181b; margin-bottom: 16px;">Heads up — we marked your post</h2>
          <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
            Your post was detected as containing adult content, so we automatically marked it as <strong>${markingLabel}</strong>. This helps other users control what they see in their feed.
          </p>
          <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
            Next time, please mark your post yourself when uploading this type of content. You can do this from the content flags option in the post editor.
          </p>
          <p style="color: #71717a; font-size: 14px; line-height: 1.6;">
            Users found to be intentionally not labeling content will be removed from the platform. We must all do our part to keep the community safe. While we don&apos;t have minors, we need to make sure people don&apos;t see NSFW content unwanted, and that no one without age verification can see graphic/explicit posts. Please reach out with any questions.
          </p>
          <a href="${postUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #18181b; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">
            View Post
          </a>
          <p style="color: #a1a1aa; font-size: 12px; margin-top: 32px;">
            Please review the <a href="${baseUrl}" style="color: #a1a1aa;">content guidelines</a> for more information.
          </p>
        </div>
      `,
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { emailType: "content-notice", toEmail, postId },
    });
  }
}


export async function sendModerationAlertEmail(params: {
  postId: string;
  authorUsername: string;
  violationType: string;
  confidence: number;
  contentPreview: string;
}) {
  const { postId, authorUsername, violationType, confidence, contentPreview } = params;
  const baseUrl = getBaseUrl();
  const postUrl = `${baseUrl}/post/${postId}`;

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: "vibrantsocial@proton.me",
      subject: `Moderation Alert: ${violationType} detected — @${authorUsername}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #18181b; margin-bottom: 16px;">Moderation Alert</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #71717a; font-size: 14px; vertical-align: top; width: 120px;">Type</td>
              <td style="padding: 8px 0; color: #18181b; font-size: 14px;">${escapeHtml(violationType)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #71717a; font-size: 14px; vertical-align: top;">Author</td>
              <td style="padding: 8px 0; color: #18181b; font-size: 14px;">@${escapeHtml(authorUsername)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #71717a; font-size: 14px; vertical-align: top;">Confidence</td>
              <td style="padding: 8px 0; color: #18181b; font-size: 14px;">${(confidence * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #71717a; font-size: 14px; vertical-align: top;">Preview</td>
              <td style="padding: 8px 0; color: #18181b; font-size: 14px;">${escapeHtml(contentPreview)}</td>
            </tr>
          </table>
          <a href="${postUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #18181b; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">
            Review Post
          </a>
          <p style="color: #a1a1aa; font-size: 12px; margin-top: 32px;">
            Detected at ${new Date().toISOString()}
          </p>
        </div>
      `,
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { emailType: "moderation-alert", postId, violationType },
    });
  }
}


export async function sendSuspensionEmail(params: {
  toEmail: string;
  reason: string;
}) {
  const { toEmail, reason } = params;
  const baseUrl = getBaseUrl();

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: "Your account has been suspended",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #18181b; margin-bottom: 16px;">Account Suspended</h2>
          <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
            Your VibrantSocial account has been suspended for the following reason:
          </p>
          <p style="color: #18181b; font-size: 16px; line-height: 1.6; background: #f4f4f5; padding: 12px 16px; border-radius: 8px;">
            ${escapeHtml(reason)}
          </p>
          <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
            If you believe this was a mistake, you can submit an appeal.
          </p>
          <a href="${baseUrl}/appeal" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #18181b; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">
            Submit an Appeal
          </a>
          <p style="color: #a1a1aa; font-size: 12px; margin-top: 32px;">
            Please review the <a href="${baseUrl}/tos" style="color: #a1a1aa;">terms of service</a> for more information.
          </p>
        </div>
      `,
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { emailType: "suspension", toEmail },
    });
  }
}

export async function sendAppealResponseEmail(params: {
  toEmail: string;
  status: "approved" | "denied";
  response: string;
}) {
  const { toEmail, status, response } = params;
  const baseUrl = getBaseUrl();
  const isApproved = status === "approved";

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: `Your appeal has been ${isApproved ? "approved" : "denied"}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #18181b; margin-bottom: 16px;">Appeal ${isApproved ? "Approved" : "Denied"}</h2>
          <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
            ${isApproved
              ? "Good news — your appeal has been reviewed and approved. Any actions have been reversed."
              : "Your appeal has been reviewed and denied. The original action stands."}
          </p>
          <p style="color: #18181b; font-size: 16px; line-height: 1.6; background: #f4f4f5; padding: 12px 16px; border-radius: 8px;">
            ${escapeHtml(response)}
          </p>
          <a href="${baseUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #18181b; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">
            Go to VibrantSocial
          </a>
        </div>
      `,
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { emailType: "appeal-response", toEmail, status },
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
