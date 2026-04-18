import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/messaging_api.dart';
import '../models/chat.dart';

class ConversationListState {
  const ConversationListState({
    required this.conversations,
    required this.isLoading,
    required this.error,
  });

  final List<ConversationListItem> conversations;
  final bool isLoading;
  final Object? error;

  ConversationListState copyWith({
    List<ConversationListItem>? conversations,
    bool? isLoading,
    Object? error,
    bool clearError = false,
  }) {
    return ConversationListState(
      conversations: conversations ?? this.conversations,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }

  static const initial = ConversationListState(
    conversations: [],
    isLoading: false,
    error: null,
  );
}

class ConversationListController extends StateNotifier<ConversationListState> {
  ConversationListController(this._api) : super(ConversationListState.initial) {
    refresh();
  }

  final MessagingApi _api;

  Future<void> refresh() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final list = await _api.getConversations();
      state = state.copyWith(conversations: list, isLoading: false);
    } catch (err) {
      state = state.copyWith(isLoading: false, error: err);
    }
  }
}
