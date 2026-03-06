export interface ChatUserProfile {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatar: string | null;
  image: string | null;
}

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
  } | null;
  unreadCount: number;
}

export interface MessageData {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  sender: ChatUserProfile;
}

export interface MessageRequestData {
  id: string;
  senderId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: Date;
  sender: ChatUserProfile;
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
