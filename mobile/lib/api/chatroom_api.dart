import '../models/chat.dart';
import 'messaging_api.dart' show SendMessageResult;
import 'rpc_client.dart';

/// Covers public chatrooms (lobby + others). Server actions live in
/// `src/app/chatrooms/actions.ts`; dispatched via `/api/rpc`.
class ChatroomApi {
  ChatroomApi(this._rpc);

  final RpcClient _rpc;

  Future<List<ChatRoomListItem>> listRooms({bool showNsfw = false}) async {
    final list = await _rpc.callList('listChatRooms', [showNsfw]);
    return list
        .map((r) => ChatRoomListItem.fromJson((r as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<ChatMessagePage> getMessages({
    String slug = 'lobby',
    String? cursor,
  }) async {
    final data = await _rpc.callMap('getChatRoomMessages', [slug, cursor]);
    return ChatMessagePage.fromJson(data);
  }

  Future<SendMessageResult> sendMessage({
    required String slug,
    required String content,
    String? replyToId,
    String? mediaUrl,
    String? mediaType,
    String? mediaFileName,
    int? mediaFileSize,
  }) async {
    final hasOptions = replyToId != null ||
        mediaUrl != null ||
        mediaType != null ||
        mediaFileName != null ||
        mediaFileSize != null;
    final args = [
      content,
      slug,
      if (hasOptions)
        {
          'replyToId': ?replyToId,
          'mediaUrl': ?mediaUrl,
          'mediaType': ?mediaType,
          'mediaFileName': ?mediaFileName,
          'mediaFileSize': ?mediaFileSize,
        }
      else
        null,
    ];
    final data = await _rpc.callMap('sendChatRoomMessage', args);
    return SendMessageResult.fromJson(data);
  }

  Future<void> toggleReaction({
    required String messageId,
    required String emoji,
  }) async {
    await _rpc.call('toggleChatRoomReaction', [messageId, emoji]);
  }

  Future<void> deleteMessage(String messageId) async {
    await _rpc.call('deleteChatRoomMessage', [messageId]);
  }

  Future<void> editMessage({
    required String messageId,
    required String content,
  }) async {
    await _rpc.call('editChatRoomMessage', [messageId, content]);
  }
}
