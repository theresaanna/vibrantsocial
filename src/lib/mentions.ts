import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { sendMentionEmail } from "@/lib/email";

interface LexicalJsonNode {
  type: string;
  children?: LexicalJsonNode[];
  username?: string;
  [key: string]: unknown;
}

export function extractMentionsFromLexicalJson(jsonString: string): string[] {
  try {
    const parsed = JSON.parse(jsonString);
    const usernames = new Set<string>();

    function walk(nodes: LexicalJsonNode[]) {
      for (const node of nodes) {
        if (node.type === "mention" && typeof node.username === "string") {
          usernames.add(node.username.toLowerCase());
        }
        if (node.children) {
          walk(node.children);
        }
      }
    }

    if (parsed?.root?.children) {
      walk(parsed.root.children);
    }
    return Array.from(usernames);
  } catch {
    return [];
  }
}

export function extractMentionsFromPlainText(text: string): string[] {
  const regex = /@([a-zA-Z0-9_]{3,30})/g;
  const usernames = new Set<string>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    usernames.add(match[1].toLowerCase());
  }
  return Array.from(usernames);
}

export async function createMentionNotifications(params: {
  usernames: string[];
  actorId: string;
  postId?: string;
  commentId?: string;
}): Promise<void> {
  if (params.usernames.length === 0) return;

  // Fetch mentioned users with email info
  const users = await prisma.user.findMany({
    where: { username: { in: params.usernames, mode: "insensitive" } },
    select: { id: true, email: true, emailOnMention: true },
  });

  // Fetch actor name for email
  const actor = await prisma.user.findUnique({
    where: { id: params.actorId },
    select: { displayName: true, username: true, name: true },
  });
  const actorName =
    actor?.displayName ?? actor?.username ?? actor?.name ?? "Someone";

  await Promise.all(
    users.map(async (user: { id: string; email: string | null; emailOnMention: boolean }) => {
      await createNotification({
        type: "MENTION",
        actorId: params.actorId,
        targetUserId: user.id,
        postId: params.postId,
        commentId: params.commentId,
      });

      // Send email if the user has an email and mention notifications enabled
      if (
        user.id !== params.actorId &&
        user.email &&
        user.emailOnMention &&
        params.postId
      ) {
        sendMentionEmail({
          toEmail: user.email,
          mentionerName: actorName,
          postId: params.postId,
          commentId: params.commentId,
        });
      }
    })
  );
}
