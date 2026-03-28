export interface ChatUserProfile {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatar: string | null;
  image: string | null;
  profileFrameId: string | null;
  usernameFont?: string | null;
}

export type MediaType = "image" | "video" | "audio" | "document";

export interface ConversationListItem {
  id: string;
  isGroup: boolean;
  name: string | null;
  avatarUrl: string | null;
  participants: ChatUserProfile[];
  lastMessage: {
    content: string;
    senderId: string;
    createdAt: Date;
    mediaType?: MediaType | null;
  } | null;
  unreadCount: number;
}

export interface ReactionGroup {
  emoji: string;
  userIds: string[];
}

export interface MessageReplyTo {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  mediaType: MediaType | null;
  deletedAt: Date | null;
}

export interface MessageData {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  mediaFileName: string | null;
  mediaFileSize: number | null;
  isNsfw: boolean;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  sender: ChatUserProfile;
  reactions: ReactionGroup[];
  replyTo: MessageReplyTo | null;
}

export interface MessageRequestData {
  id: string;
  senderId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: Date;
  sender: ChatUserProfile;
}

export interface ChatThemeColors {
  bgColor: string | null;
  textColor: string | null;
  containerColor: string | null;
  secondaryColor: string | null;
}

export interface ActionState {
  success: boolean;
  message: string;
}

export interface ConversationWithParticipants {
  id: string;
  isGroup: boolean;
  name: string | null;
  avatarUrl: string | null;
  participants: {
    id: string;
    userId: string;
    isAdmin: boolean;
    lastReadAt: Date | null;
    user: ChatUserProfile;
  }[];
}
