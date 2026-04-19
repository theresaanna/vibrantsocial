import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/messaging_api.dart';
import '../models/chat.dart';

class MessageRequestsState {
  const MessageRequestsState({
    required this.requests,
    required this.isLoading,
    required this.error,
  });

  final List<MessageRequest> requests;
  final bool isLoading;
  final Object? error;

  MessageRequestsState copyWith({
    List<MessageRequest>? requests,
    bool? isLoading,
    Object? error,
    bool clearError = false,
  }) {
    return MessageRequestsState(
      requests: requests ?? this.requests,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }

  static const initial =
      MessageRequestsState(requests: [], isLoading: false, error: null);
}

class MessageRequestsController extends StateNotifier<MessageRequestsState> {
  MessageRequestsController(this._api) : super(MessageRequestsState.initial) {
    refresh();
  }

  final MessagingApi _api;

  Future<void> refresh() async {
    if (!mounted) return;
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final list = await _api.getMessageRequests();
      if (!mounted) return;
      state = state.copyWith(requests: list, isLoading: false);
    } catch (err) {
      if (!mounted) return;
      state = state.copyWith(isLoading: false, error: err);
    }
  }

  /// Optimistic local removal — the screen calls this after a successful
  /// accept or decline so the row disappears without waiting for refresh.
  void removeLocal(String requestId) {
    state = state.copyWith(
      requests: [for (final r in state.requests) if (r.id != requestId) r],
    );
  }
}
