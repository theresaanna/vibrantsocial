import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/chat.dart';
export '../models/chat.dart' show ReactionGroup;

/// Fetches a page older than [cursor] (or the newest page if null).
/// Returns messages in chronological order (oldest first).
typedef ChatMessagePageFetcher = Future<ChatMessagePage> Function(String? cursor);

class ChatMessageListState {
  const ChatMessageListState({
    required this.messages,
    required this.nextCursor,
    required this.isLoadingMore,
    required this.isSending,
    required this.error,
  });

  /// Chronological order: oldest → newest. The newest message is last.
  final List<ChatMessage> messages;
  final String? nextCursor;
  final bool isLoadingMore;
  final bool isSending;
  final Object? error;

  bool get hasMore => nextCursor != null;

  ChatMessageListState copyWith({
    List<ChatMessage>? messages,
    String? nextCursor,
    bool clearCursor = false,
    bool? isLoadingMore,
    bool? isSending,
    Object? error,
    bool clearError = false,
  }) {
    return ChatMessageListState(
      messages: messages ?? this.messages,
      nextCursor: clearCursor ? null : (nextCursor ?? this.nextCursor),
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      isSending: isSending ?? this.isSending,
      error: clearError ? null : (error ?? this.error),
    );
  }

  static const initial = ChatMessageListState(
    messages: [],
    nextCursor: null,
    isLoadingMore: false,
    isSending: false,
    error: null,
  );
}

/// Paginated chat message list. Older messages load by cursor; realtime
/// additions come in via [appendLive]. Duplicate ids are ignored so the
/// optimistic-echo case (send → server insert → Ably "new" event) stays
/// idempotent.
class ChatMessageListController extends StateNotifier<ChatMessageListState> {
  ChatMessageListController(this._fetch) : super(ChatMessageListState.initial) {
    loadMore();
  }

  final ChatMessagePageFetcher _fetch;
  bool _initialLoaded = false;

  Future<void> loadMore() async {
    if (!mounted) return;
    if (state.isLoadingMore) return;
    if (_initialLoaded && !state.hasMore) return;

    state = state.copyWith(isLoadingMore: true, clearError: true);
    try {
      final page = await _fetch(state.nextCursor);
      if (!mounted) return;
      _initialLoaded = true;
      // Older messages from the server are chronological within the page;
      // prepend them to the existing list.
      state = state.copyWith(
        messages: [...page.messages, ...state.messages],
        nextCursor: page.nextCursor,
        clearCursor: page.nextCursor == null,
        isLoadingMore: false,
      );
    } catch (err) {
      if (!mounted) return;
      state = state.copyWith(isLoadingMore: false, error: err);
    }
  }

  Future<void> refresh() async {
    _initialLoaded = false;
    state = ChatMessageListState.initial;
    await loadMore();
  }

  /// Append a newly-arrived message (from Ably). Ignored if its id is
  /// already in the list.
  void appendLive(ChatMessage message) {
    if (state.messages.any((m) => m.id == message.id)) return;
    state = state.copyWith(messages: [...state.messages, message]);
  }

  /// Apply an edit event to the matching message, if present.
  void applyEdit(String id, String content, DateTime editedAt) {
    var changed = false;
    final next = [
      for (final m in state.messages)
        if (m.id == id) (() {
          changed = true;
          return m.copyWith(content: content, editedAt: editedAt);
        })() else m,
    ];
    if (changed) state = state.copyWith(messages: next);
  }

  /// Apply a delete event to the matching message, if present.
  void applyDelete(String id, DateTime deletedAt) {
    var changed = false;
    final next = [
      for (final m in state.messages)
        if (m.id == id) (() {
          changed = true;
          return m.copyWith(deletedAt: deletedAt);
        })() else m,
    ];
    if (changed) state = state.copyWith(messages: next);
  }

  /// Fully remove a message from local state after the async moderation
  /// scan flagged it NSFW. Unlike [applyDelete] (which keeps a "deleted"
  /// placeholder), redaction leaves no trace — Play-policy on mobile is
  /// that NSFW content must be completely unavailable.
  void applyRedaction(String id) {
    final next = state.messages.where((m) => m.id != id).toList();
    if (next.length == state.messages.length) return;
    state = state.copyWith(messages: next);
  }

  /// Replace the reactions on a message in-place.
  void applyReactions(String id, List<ReactionGroup> reactions) {
    var changed = false;
    final next = [
      for (final m in state.messages)
        if (m.id == id) (() {
          changed = true;
          return m.copyWith(reactions: reactions);
        })() else m,
    ];
    if (changed) state = state.copyWith(messages: next);
  }

  void setSending(bool value) {
    state = state.copyWith(isSending: value);
  }
}
