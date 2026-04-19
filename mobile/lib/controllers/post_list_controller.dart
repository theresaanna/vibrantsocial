import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/post.dart';

/// Fetcher signature shared by the feed and profile-posts lists: takes a
/// cursor (null = first page) and returns a page of posts plus the next
/// cursor, or null when the list is exhausted.
typedef PostPageFetcher = Future<PostPage> Function(String? cursor);

class PostListState {
  const PostListState({
    required this.posts,
    required this.nextCursor,
    required this.isLoadingMore,
    required this.error,
  });

  final List<Post> posts;
  final String? nextCursor;
  final bool isLoadingMore;
  final Object? error;

  bool get hasMore => nextCursor != null;

  PostListState copyWith({
    List<Post>? posts,
    String? nextCursor,
    bool clearCursor = false,
    bool? isLoadingMore,
    Object? error,
    bool clearError = false,
  }) {
    return PostListState(
      posts: posts ?? this.posts,
      nextCursor: clearCursor ? null : (nextCursor ?? this.nextCursor),
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
    );
  }

  static const initial = PostListState(
    posts: [],
    nextCursor: null,
    isLoadingMore: false,
    error: null,
  );
}

class PostListController extends StateNotifier<PostListState> {
  PostListController(this._fetch) : super(PostListState.initial) {
    loadMore();
  }

  final PostPageFetcher _fetch;
  bool _initialLoaded = false;

  Future<void> loadMore() async {
    if (!mounted) return;
    if (state.isLoadingMore) return;
    if (_initialLoaded && !state.hasMore) return;

    state = state.copyWith(isLoadingMore: true, clearError: true);
    try {
      final page = await _fetch(state.nextCursor);
      // Drop late results — the provider may have been rebuilt while
      // this fetch was in flight (e.g. NSFW pref flip refreshes feed).
      if (!mounted) return;
      _initialLoaded = true;
      state = state.copyWith(
        posts: [...state.posts, ...page.posts],
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
    state = PostListState.initial;
    await loadMore();
  }

  /// Replace the post in the loaded list matching [postId] using the
  /// given mutator. No-op if the id isn't present — a detail-screen
  /// mutation, say, won't reach back into feeds the viewer hasn't
  /// scrolled to yet.
  void updatePost(String postId, Post Function(Post current) mutator) {
    var changed = false;
    final next = [
      for (final p in state.posts)
        if (p.id == postId) (() {
          changed = true;
          return mutator(p);
        })() else p,
    ];
    if (changed) state = state.copyWith(posts: next);
  }
}
