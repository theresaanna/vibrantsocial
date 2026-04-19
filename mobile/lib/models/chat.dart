/// Chat models — cover both 1:1 / group DMs and public chatrooms.
///
/// The server exposes these via the RPC dispatcher at `/api/rpc`
/// (see `src/app/api/rpc/route.ts`). DM and chatroom messages have
/// nearly-identical shapes; we use [ChatMessage] for both.
library;

class ChatUser {
  ChatUser({
    required this.id,
    required this.username,
    required this.displayName,
    required this.name,
    required this.avatar,
    required this.profileFrameId,
    required this.usernameFont,
  });

  final String id;
  final String? username;
  final String? displayName;
  final String? name;
  final String? avatar;
  final String? profileFrameId;
  final String? usernameFont;

  String get label {
    if (displayName != null && displayName!.isNotEmpty) return displayName!;
    if (username != null && username!.isNotEmpty) return username!;
    if (name != null && name!.isNotEmpty) return name!;
    return 'User';
  }

  factory ChatUser.fromJson(Map<String, dynamic> json) {
    return ChatUser(
      id: json['id'] as String,
      username: json['username'] as String?,
      displayName: json['displayName'] as String?,
      name: json['name'] as String?,
      avatar: (json['avatar'] ?? json['image']) as String?,
      profileFrameId: json['profileFrameId'] as String?,
      usernameFont: json['usernameFont'] as String?,
    );
  }
}

class MessageReplyTo {
  MessageReplyTo({
    required this.id,
    required this.content,
    required this.senderId,
    required this.senderName,
    required this.senderUsernameFont,
    required this.deletedAt,
  });

  final String id;
  final String content;
  final String senderId;
  final String senderName;
  final String? senderUsernameFont;
  final DateTime? deletedAt;

  factory MessageReplyTo.fromJson(Map<String, dynamic> json) {
    // DM shape flattens sender to `senderName` + `senderUsernameFont`;
    // chatroom shape keeps the nested `sender` object.
    String? name = json['senderName'] as String?;
    String? font = json['senderUsernameFont'] as String?;
    if ((name == null || font == null) && json['sender'] is Map) {
      final s = (json['sender'] as Map).cast<String, dynamic>();
      name ??= (s['displayName'] ?? s['username'] ?? s['name']) as String?;
      font ??= s['usernameFont'] as String?;
    }
    return MessageReplyTo(
      id: json['id'] as String,
      content: json['content'] as String? ?? '',
      senderId: json['senderId'] as String,
      senderName: name ?? 'User',
      senderUsernameFont: font,
      deletedAt: _parseDate(json['deletedAt']),
    );
  }
}

class ReactionGroup {
  ReactionGroup({
    required this.emoji,
    required this.userIds,
    required this.userNames,
  });

  final String emoji;
  final List<String> userIds;
  final List<String> userNames;

  int get count => userIds.length;
  bool reactedBy(String userId) => userIds.contains(userId);

  factory ReactionGroup.fromJson(Map<String, dynamic> json) {
    return ReactionGroup(
      emoji: json['emoji'] as String,
      userIds: (json['userIds'] as List? ?? const []).cast<String>(),
      userNames: (json['userNames'] as List? ?? const []).cast<String>(),
    );
  }
}

class ChatMessage {
  ChatMessage({
    required this.id,
    required this.conversationId,
    required this.roomId,
    required this.senderId,
    required this.content,
    required this.mediaUrl,
    required this.mediaType,
    required this.mediaThumbUrl,
    required this.editedAt,
    required this.deletedAt,
    required this.createdAt,
    required this.sender,
    required this.replyTo,
    required this.reactions,
  });

  final String id;
  final String? conversationId;
  final String? roomId;
  final String senderId;
  final String content;
  final String? mediaUrl;
  final String? mediaType;
  final String? mediaThumbUrl;
  final DateTime? editedAt;
  final DateTime? deletedAt;
  final DateTime createdAt;
  final ChatUser? sender;
  final MessageReplyTo? replyTo;
  final List<ReactionGroup> reactions;

  bool get isDeleted => deletedAt != null;

  ChatMessage copyWith({
    String? content,
    DateTime? editedAt,
    DateTime? deletedAt,
    List<ReactionGroup>? reactions,
  }) {
    return ChatMessage(
      id: id,
      conversationId: conversationId,
      roomId: roomId,
      senderId: senderId,
      content: content ?? this.content,
      mediaUrl: mediaUrl,
      mediaType: mediaType,
      mediaThumbUrl: mediaThumbUrl,
      editedAt: editedAt ?? this.editedAt,
      deletedAt: deletedAt ?? this.deletedAt,
      createdAt: createdAt,
      sender: sender,
      replyTo: replyTo,
      reactions: reactions ?? this.reactions,
    );
  }

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] as String,
      conversationId: json['conversationId'] as String?,
      roomId: json['roomId'] as String?,
      senderId: json['senderId'] as String,
      content: (json['content'] ?? '') as String,
      mediaUrl: json['mediaUrl'] as String?,
      mediaType: json['mediaType'] as String?,
      mediaThumbUrl: json['mediaThumbUrl'] as String?,
      editedAt: _parseDate(json['editedAt']),
      deletedAt: _parseDate(json['deletedAt']),
      createdAt: _parseDate(json['createdAt']) ?? DateTime.now(),
      sender: json['sender'] is Map
          ? ChatUser.fromJson((json['sender'] as Map).cast<String, dynamic>())
          : null,
      replyTo: json['replyTo'] is Map
          ? MessageReplyTo.fromJson((json['replyTo'] as Map).cast<String, dynamic>())
          : null,
      reactions: (json['reactions'] as List? ?? const [])
          .map((r) => ReactionGroup.fromJson((r as Map).cast<String, dynamic>()))
          .toList(),
    );
  }
}

class ChatMessagePage {
  ChatMessagePage({required this.messages, required this.nextCursor});

  /// Messages in chronological order (oldest first), as returned by the
  /// server. Callers render bottom-to-top by reversing when needed.
  final List<ChatMessage> messages;
  final String? nextCursor;

  factory ChatMessagePage.fromJson(Map<String, dynamic> json) {
    final list = (json['messages'] as List? ?? const [])
        .map((m) => ChatMessage.fromJson((m as Map).cast<String, dynamic>()))
        .toList();
    return ChatMessagePage(
      messages: list,
      nextCursor: json['nextCursor'] as String?,
    );
  }
}

class ConversationLastMessage {
  ConversationLastMessage({
    required this.content,
    required this.senderId,
    required this.createdAt,
    required this.mediaType,
  });

  final String content;
  final String senderId;
  final DateTime createdAt;
  final String? mediaType;

  factory ConversationLastMessage.fromJson(Map<String, dynamic> json) {
    return ConversationLastMessage(
      content: (json['content'] ?? '') as String,
      senderId: json['senderId'] as String,
      createdAt: _parseDate(json['createdAt']) ?? DateTime.now(),
      mediaType: json['mediaType'] as String?,
    );
  }
}

class ConversationListItem {
  ConversationListItem({
    required this.id,
    required this.isGroup,
    required this.name,
    required this.avatarUrl,
    required this.participants,
    required this.lastMessage,
    required this.unreadCount,
  });

  final String id;
  final bool isGroup;
  final String? name;
  final String? avatarUrl;
  final List<ChatUser> participants;
  final ConversationLastMessage? lastMessage;
  final int unreadCount;

  /// Display title for list rows — group name or the other participant's label.
  String displayTitle(String viewerId) {
    if (isGroup && name != null && name!.isNotEmpty) return name!;
    final other = participants.firstWhere(
      (p) => p.id != viewerId,
      orElse: () => participants.isNotEmpty ? participants.first : ChatUser(
        id: '', username: null, displayName: null, name: null,
        avatar: null, profileFrameId: null, usernameFont: null,
      ),
    );
    return other.label;
  }

  String? displayAvatar(String viewerId) {
    if (isGroup) return avatarUrl;
    final other = participants.firstWhere(
      (p) => p.id != viewerId,
      orElse: () => participants.isNotEmpty ? participants.first : ChatUser(
        id: '', username: null, displayName: null, name: null,
        avatar: null, profileFrameId: null, usernameFont: null,
      ),
    );
    return other.avatar;
  }

  factory ConversationListItem.fromJson(Map<String, dynamic> json) {
    return ConversationListItem(
      id: json['id'] as String,
      isGroup: json['isGroup'] as bool? ?? false,
      name: json['name'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      participants: (json['participants'] as List? ?? const [])
          .map((p) => ChatUser.fromJson((p as Map).cast<String, dynamic>()))
          .toList(),
      lastMessage: json['lastMessage'] is Map
          ? ConversationLastMessage.fromJson(
              (json['lastMessage'] as Map).cast<String, dynamic>(),
            )
          : null,
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Pending incoming chat request — sent by [sender], waiting on the
/// viewer to accept or decline. Mirrors `MessageRequestData` in
/// `src/types/chat.ts`.
class MessageRequest {
  MessageRequest({
    required this.id,
    required this.senderId,
    required this.status,
    required this.createdAt,
    required this.sender,
  });

  final String id;
  final String senderId;
  final String status;
  final DateTime createdAt;
  final ChatUser sender;

  factory MessageRequest.fromJson(Map<String, dynamic> json) {
    return MessageRequest(
      id: json['id'] as String,
      senderId: json['senderId'] as String,
      status: json['status'] as String? ?? 'PENDING',
      createdAt: _parseDate(json['createdAt']) ?? DateTime.now(),
      sender: ChatUser.fromJson((json['sender'] as Map).cast<String, dynamic>()),
    );
  }
}

class ChatRoomListItem {
  ChatRoomListItem({
    required this.id,
    required this.slug,
    required this.name,
    required this.status,
    required this.isNsfw,
    required this.messageCount,
    required this.lastMessageAt,
  });

  final String id;
  final String slug;
  final String name;
  final String? status;
  final bool isNsfw;
  final int messageCount;
  final DateTime? lastMessageAt;

  factory ChatRoomListItem.fromJson(Map<String, dynamic> json) {
    return ChatRoomListItem(
      id: json['id'] as String,
      slug: json['slug'] as String,
      name: json['name'] as String,
      status: json['status'] as String?,
      isNsfw: json['isNsfw'] as bool? ?? false,
      messageCount: (json['messageCount'] as num?)?.toInt() ?? 0,
      lastMessageAt: _parseDate(json['lastMessageAt']),
    );
  }
}

DateTime? _parseDate(dynamic value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  if (value is String) return DateTime.tryParse(value);
  return null;
}
