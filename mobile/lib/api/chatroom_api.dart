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
  }) async {
    final args = [
      content,
      slug,
      if (replyToId != null) {'replyToId': replyToId} else null,
    ];
    final data = await _rpc.callMap('sendChatRoomMessage', args);
    return SendMessageResult.fromJson(data);
  }
}
