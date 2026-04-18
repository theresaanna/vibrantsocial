import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/profile_api.dart';
import '../models/user_list.dart';

/// Key that identifies which follow-style list a controller is managing.
/// Uses equals/hashCode so Riverpod's family caching works correctly.
class ProfileListKey {
  const ProfileListKey({required this.username, required this.kind});

  final String username;
  final ProfileListKind kind;

  @override
  bool operator ==(Object other) =>
      other is ProfileListKey && other.username == username && other.kind == kind;

  @override
  int get hashCode => Object.hash(username, kind);
}

/// Snapshot of an in-progress paginated user-list. Designed to plug into
/// a `ListView.builder` + scroll-listener for infinite pagination.
class ProfileListState {
  const ProfileListState({
    required this.users,
    required this.nextCursor,
    required this.isLoadingMore,
    required this.error,
  });

  final List<UserListEntry> users;
  final String? nextCursor;
  final bool isLoadingMore;
  final Object? error;

  bool get hasMore => nextCursor != null;

  ProfileListState copyWith({
    List<UserListEntry>? users,
    String? nextCursor,
    bool clearCursor = false,
    bool? isLoadingMore,
    Object? error,
    bool clearError = false,
  }) {
    return ProfileListState(
      users: users ?? this.users,
      nextCursor: clearCursor ? null : (nextCursor ?? this.nextCursor),
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
    );
  }

  static const initial = ProfileListState(
    users: [],
    nextCursor: null,
    isLoadingMore: false,
    error: null,
  );
}

class ProfileListController extends StateNotifier<ProfileListState> {
  ProfileListController(this._api, this._key) : super(ProfileListState.initial) {
    loadMore();
  }

  final ProfileApi _api;
  final ProfileListKey _key;
  bool _initialLoaded = false;

  Future<void> loadMore() async {
    if (state.isLoadingMore) return;
    // Don't call loadMore after we've already exhausted the list.
    if (_initialLoaded && !state.hasMore) return;

    state = state.copyWith(isLoadingMore: true, clearError: true);
    try {
      final page = await _api.fetchList(
        username: _key.username,
        kind: _key.kind,
        cursor: state.nextCursor,
      );
      _initialLoaded = true;
      state = state.copyWith(
        users: [...state.users, ...page.users],
        nextCursor: page.nextCursor,
        clearCursor: page.nextCursor == null,
        isLoadingMore: false,
      );
    } catch (err) {
      state = state.copyWith(isLoadingMore: false, error: err);
    }
  }

  Future<void> refresh() async {
    _initialLoaded = false;
    state = ProfileListState.initial;
    await loadMore();
  }
}
