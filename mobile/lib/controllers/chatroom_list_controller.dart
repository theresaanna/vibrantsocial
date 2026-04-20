import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/chatroom_api.dart';
import '../models/chat.dart';

class ChatroomListState {
  const ChatroomListState({
    required this.rooms,
    required this.isLoading,
    required this.error,
  });

  final List<ChatRoomListItem> rooms;
  final bool isLoading;
  final Object? error;

  ChatroomListState copyWith({
    List<ChatRoomListItem>? rooms,
    bool? isLoading,
    Object? error,
    bool clearError = false,
  }) {
    return ChatroomListState(
      rooms: rooms ?? this.rooms,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }

  static const initial = ChatroomListState(rooms: [], isLoading: false, error: null);
}

class ChatroomListController extends StateNotifier<ChatroomListState> {
  ChatroomListController(this._api) : super(ChatroomListState.initial) {
    refresh();
  }

  final ChatroomApi _api;

  Future<void> refresh() async {
    if (!mounted) return;
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      // Server-side Play policy always hides NSFW rooms from mobile
      // callers — no flag needs to be passed.
      final rooms = await _api.listRooms();
      if (!mounted) return;
      state = state.copyWith(rooms: rooms, isLoading: false);
    } catch (err) {
      if (!mounted) return;
      state = state.copyWith(isLoading: false, error: err);
    }
  }
}
