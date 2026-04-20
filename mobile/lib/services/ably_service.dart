import 'dart:async';
import 'dart:convert';

import 'package:ably_flutter/ably_flutter.dart' as ably;
import 'package:dio/dio.dart';

import '../models/chat.dart';

/// Thin wrapper around the Ably Realtime client. One instance per app —
/// it lazily connects on first subscribe, using a token request fetched
/// from `/api/ably-token` (which accepts the mobile Bearer token).
///
/// Channel naming matches the web app:
///   - `chat:{conversationId}`   — DM messages
///   - `chat-notify:{userId}`    — unread badge pings (not consumed here yet)
///   - `chatroom:{slug}`         — chatroom messages
class AblyService {
  AblyService(this._dio);

  final Dio _dio;
  ably.Realtime? _client;

  /// Exposes the shared Realtime client, creating it on first use. Other
  /// services (e.g. `PushService`) need it to construct an `ably.Push`
  /// instance tied to the same connection + auth.
  ably.Realtime ensureClient() => _ensureClient();

  ably.Realtime _ensureClient() {
    final existing = _client;
    if (existing != null) return existing;
    final options = ably.ClientOptions(
      authCallback: (params) async {
        final res = await _dio.get<Map<String, dynamic>>('/api/ably-token');
        final data = res.data;
        if (data == null) {
          throw StateError('ably-token returned empty body');
        }
        return ably.TokenRequest.fromMap(data);
      },
      autoConnect: true,
    );
    final created = ably.Realtime(options: options);
    _client = created;
    return created;
  }

  /// Subscribe to a DM conversation. Returns a handle the caller must
  /// close when leaving the screen.
  ///
  /// [onNsfwRedaction] fires when the async moderation scan flags a
  /// message as NSFW after it was already delivered via realtime. The
  /// Flutter app must fully remove such messages (Play policy — the
  /// server-side re-fetch filters them, but in-memory state from the
  /// initial push needs to be cleaned up too).
  ChatChannelSubscription subscribeConversation(
    String conversationId, {
    required void Function(ChatMessage message) onNew,
    void Function(String id, String content, DateTime editedAt)? onEdit,
    void Function(String id, DateTime deletedAt)? onDelete,
    void Function(String id, List<ReactionGroup> reactions)? onReaction,
    void Function(String id)? onNsfwRedaction,
  }) {
    final channel = _ensureClient().channels.get('chat:$conversationId');
    return _subscribeChannel(
      channel,
      onNew: onNew,
      onEdit: onEdit,
      onDelete: onDelete,
      onReaction: onReaction,
      onNsfwRedaction: onNsfwRedaction,
    );
  }

  /// Subscribe to a chatroom. Messages are published as JSON-stringified
  /// payloads (see `sendChatRoomMessage`); DMs publish plain objects.
  ChatChannelSubscription subscribeRoom(
    String slug, {
    required void Function(ChatMessage message) onNew,
    void Function(String id, String content, DateTime editedAt)? onEdit,
    void Function(String id, DateTime deletedAt)? onDelete,
    void Function(String id, List<ReactionGroup> reactions)? onReaction,
    void Function(String id)? onNsfwRedaction,
  }) {
    final channel = _ensureClient().channels.get('chatroom:$slug');
    return _subscribeChannel(
      channel,
      onNew: onNew,
      onEdit: onEdit,
      onDelete: onDelete,
      onReaction: onReaction,
      onNsfwRedaction: onNsfwRedaction,
    );
  }

  /// Subscribe to the viewer's `chat-notify:{userId}` channel. Server
  /// publishes a ping whenever any DM the viewer participates in gets a
  /// new message — handy for keeping unread badges in sync without
  /// subscribing to every conversation channel individually.
  ChatChannelSubscription subscribeNotify(
    String userId, {
    required void Function() onPing,
  }) {
    final channel = _ensureClient().channels.get('chat-notify:$userId');
    final sub = channel.subscribe(name: 'new').listen((_) => onPing());
    return ChatChannelSubscription._(channel, [sub]);
  }

  ChatChannelSubscription _subscribeChannel(
    ably.RealtimeChannel channel, {
    required void Function(ChatMessage message) onNew,
    void Function(String id, String content, DateTime editedAt)? onEdit,
    void Function(String id, DateTime deletedAt)? onDelete,
    void Function(String id, List<ReactionGroup> reactions)? onReaction,
    void Function(String id)? onNsfwRedaction,
  }) {
    final subs = <StreamSubscription<dynamic>>[];

    subs.add(
      channel.subscribe(name: 'new').listen((msg) {
        final data = _decode(msg.data);
        if (data == null) return;
        try {
          // DM publish stringifies `sender` and `replyTo`; chatroom
          // publish sends them as plain objects. Normalize both shapes.
          final senderRaw = data['sender'];
          if (senderRaw is String) {
            data['sender'] = jsonDecode(senderRaw);
          }
          final replyRaw = data['replyTo'];
          if (replyRaw is String) {
            data['replyTo'] = jsonDecode(replyRaw);
          }
          onNew(ChatMessage.fromJson(data));
        } catch (_) {
          // Bad payload — skip rather than crash the stream.
        }
      }),
    );

    if (onEdit != null) {
      subs.add(
        channel.subscribe(name: 'edit').listen((msg) {
          final data = _decode(msg.data);
          if (data == null) return;
          final id = data['id'] as String?;
          final content = data['content'] as String?;
          final editedAt = _parseIsoDate(data['editedAt']);
          if (id != null && content != null && editedAt != null) {
            onEdit(id, content, editedAt);
          }
        }),
      );
    }

    if (onDelete != null) {
      subs.add(
        channel.subscribe(name: 'delete').listen((msg) {
          final data = _decode(msg.data);
          if (data == null) return;
          final id = data['id'] as String?;
          final deletedAt = _parseIsoDate(data['deletedAt']);
          if (id != null && deletedAt != null) {
            onDelete(id, deletedAt);
          }
        }),
      );
    }

    if (onNsfwRedaction != null) {
      // Fired by the async moderation scan when a message is flagged
      // NSFW after delivery. Server publishes to `nsfw-update`; on
      // mobile we always redact (remove from local state). The
      // payload is `{ id, isNsfw: true }` — chatroom stringifies it,
      // DMs send it as a plain object; `_decode` normalizes both.
      subs.add(
        channel.subscribe(name: 'nsfw-update').listen((msg) {
          final data = _decode(msg.data);
          if (data == null) return;
          final id = data['id'] as String?;
          final flag = data['isNsfw'];
          if (id == null) return;
          // Only redact when the server flipped the flag on. A `false`
          // payload (moderation overturned) leaves local state as-is.
          if (flag == true) onNsfwRedaction(id);
        }),
      );
    }

    if (onReaction != null) {
      subs.add(
        channel.subscribe(name: 'reaction').listen((msg) {
          final data = _decode(msg.data);
          if (data == null) return;
          final id = data['messageId'] as String?;
          if (id == null) return;
          // Server stringifies the array — parse back to ReactionGroups.
          final raw = data['reactions'];
          dynamic parsed = raw;
          if (raw is String) {
            try {
              parsed = jsonDecode(raw);
            } catch (_) {
              return;
            }
          }
          if (parsed is! List) return;
          try {
            final reactions = parsed
                .map((r) =>
                    ReactionGroup.fromJson((r as Map).cast<String, dynamic>()))
                .toList();
            onReaction(id, reactions);
          } catch (_) {
            // Skip malformed payloads.
          }
        }),
      );
    }

    return ChatChannelSubscription._(channel, subs);
  }

  Map<String, dynamic>? _decode(dynamic raw) {
    if (raw is Map) return raw.cast<String, dynamic>();
    if (raw is String) {
      try {
        final parsed = jsonDecode(raw);
        if (parsed is Map) return parsed.cast<String, dynamic>();
      } catch (_) {}
    }
    return null;
  }

  DateTime? _parseIsoDate(dynamic value) {
    if (value is String) return DateTime.tryParse(value);
    return null;
  }

  Future<void> dispose() async {
    await _client?.close();
    _client = null;
  }
}

/// Handle returned by [AblyService.subscribeConversation] / `subscribeRoom`.
/// Call [close] when leaving the screen to detach and release the channel.
class ChatChannelSubscription {
  ChatChannelSubscription._(this._channel, this._subs);

  final ably.RealtimeChannel _channel;
  final List<StreamSubscription<dynamic>> _subs;

  Future<void> close() async {
    for (final s in _subs) {
      await s.cancel();
    }
    try {
      await _channel.detach();
    } catch (_) {
      // Channel may already be detached — safe to ignore.
    }
  }
}
