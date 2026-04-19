import '../models/chat.dart';
import 'rpc_client.dart';

class SendMessageResult {
  SendMessageResult({required this.success, required this.message, this.messageId});
  final bool success;
  final String message;
  final String? messageId;

  factory SendMessageResult.fromJson(Map<String, dynamic> json) {
    return SendMessageResult(
      success: json['success'] as bool? ?? false,
      message: (json['message'] ?? '') as String,
      messageId: json['messageId'] as String?,
    );
  }
}

class StartConversationResult {
  StartConversationResult({required this.success, required this.message, this.conversationId});
  final bool success;
  final String message;
  final String? conversationId;

  factory StartConversationResult.fromJson(Map<String, dynamic> json) {
    return StartConversationResult(
      success: json['success'] as bool? ?? false,
      message: (json['message'] ?? '') as String,
      conversationId: json['conversationId'] as String?,
    );
  }
}

/// Covers direct messages (1:1 + group). Server actions live in
/// `src/app/messages/actions.ts`; they're dispatched via `/api/rpc`.
class MessagingApi {
  MessagingApi(this._rpc);

  final RpcClient _rpc;

  Future<List<ConversationListItem>> getConversations() async {
    final list = await _rpc.callList('getConversations', const []);
    return list
        .map((c) => ConversationListItem.fromJson((c as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<ChatMessagePage> getMessages(String conversationId, {String? cursor}) async {
    final data = await _rpc.callMap('getMessages', [conversationId, cursor]);
    return ChatMessagePage.fromJson(data);
  }

  Future<SendMessageResult> sendMessage({
    required String conversationId,
    required String content,
    String? replyToId,
    String? mediaUrl,
    String? mediaType,
    String? mediaFileName,
    int? mediaFileSize,
  }) async {
    final data = await _rpc.callMap('sendMessage', [
      {
        'conversationId': conversationId,
        'content': content,
        'replyToId': ?replyToId,
        'mediaUrl': ?mediaUrl,
        'mediaType': ?mediaType,
        'mediaFileName': ?mediaFileName,
        'mediaFileSize': ?mediaFileSize,
      },
    ]);
    return SendMessageResult.fromJson(data);
  }

  Future<void> markConversationRead(String conversationId) async {
    await _rpc.call('markConversationRead', [conversationId]);
  }

  Future<StartConversationResult> startConversation(String targetUserId) async {
    final data = await _rpc.callMap('startConversation', [targetUserId]);
    return StartConversationResult.fromJson(data);
  }

  Future<void> toggleReaction({
    required String messageId,
    required String emoji,
  }) async {
    await _rpc.call('toggleMessageReaction', [
      {'messageId': messageId, 'emoji': emoji},
    ]);
  }

  Future<void> deleteMessage(String messageId) async {
    await _rpc.call('deleteMessage', [messageId]);
  }

  Future<void> editMessage({
    required String messageId,
    required String content,
  }) async {
    await _rpc.call('editMessage', [
      {'messageId': messageId, 'content': content},
    ]);
  }

  Future<List<MessageRequest>> getMessageRequests() async {
    final list = await _rpc.callList('getMessageRequests', const []);
    return list
        .map((r) => MessageRequest.fromJson((r as Map).cast<String, dynamic>()))
        .toList();
  }

  /// Returns the new conversation id when the request is accepted.
  Future<StartConversationResult> acceptMessageRequest(String requestId) async {
    final data = await _rpc.callMap('acceptMessageRequest', [requestId]);
    return StartConversationResult.fromJson(data);
  }

  Future<void> declineMessageRequest(String requestId) async {
    await _rpc.call('declineMessageRequest', [requestId]);
  }
}
