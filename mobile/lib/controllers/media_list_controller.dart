import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/media.dart';

typedef MediaPageFetcher = Future<MediaPostPage> Function(String? cursor);

class MediaListState {
  const MediaListState({
    required this.posts,
    required this.nextCursor,
    required this.isLoadingMore,
    required this.hasMore,
    required this.error,
  });

  final List<MediaPost> posts;
  final String? nextCursor;
  final bool isLoadingMore;
  final bool hasMore;
  final Object? error;

  MediaListState copyWith({
    List<MediaPost>? posts,
    String? nextCursor,
    bool clearCursor = false,
    bool? isLoadingMore,
    bool? hasMore,
    Object? error,
    bool clearError = false,
  }) {
    return MediaListState(
      posts: posts ?? this.posts,
      nextCursor: clearCursor ? null : (nextCursor ?? this.nextCursor),
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      hasMore: hasMore ?? this.hasMore,
      error: clearError ? null : (error ?? this.error),
    );
  }

  static const initial = MediaListState(
    posts: [],
    nextCursor: null,
    isLoadingMore: false,
    hasMore: true,
    error: null,
  );
}

class MediaListController extends StateNotifier<MediaListState> {
  MediaListController(this._fetch) : super(MediaListState.initial) {
    loadMore();
  }

  final MediaPageFetcher _fetch;

  Future<void> loadMore() async {
    if (!mounted) return;
    if (state.isLoadingMore || !state.hasMore) return;
    state = state.copyWith(isLoadingMore: true, clearError: true);
    try {
      final page = await _fetch(state.nextCursor);
      if (!mounted) return;
      state = state.copyWith(
        posts: [...state.posts, ...page.posts],
        nextCursor: page.nextCursor,
        clearCursor: page.nextCursor == null,
        hasMore: page.hasMore,
        isLoadingMore: false,
      );
    } catch (err) {
      if (!mounted) return;
      state = state.copyWith(isLoadingMore: false, error: err);
    }
  }

  Future<void> refresh() async {
    state = MediaListState.initial;
    await loadMore();
  }
}
