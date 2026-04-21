import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/post.dart';
import '../models/wall_post.dart';

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
    this.wallPosts = const [],
    this.canModerateWall = false,
  });

  final List<Post> posts;
  final String? nextCursor;
  final bool isLoadingMore;
  final Object? error;

  /// Wall posts interleaved into this feed (profile posts tab only,
  /// when the target hasn't opted into a separate Wall tab). Empty
  /// for every other feed. Consumers merge by createdAt on render.
  final List<WallPostEntry> wallPosts;

  /// Wall-owner flag for inline moderation. Only meaningful when
  /// [wallPosts] is non-empty.
  final bool canModerateWall;

  bool get hasMore => nextCursor != null;

  PostListState copyWith({
    List<Post>? posts,
    String? nextCursor,
    bool clearCursor = false,
    bool? isLoadingMore,
    Object? error,
    bool clearError = false,
    List<WallPostEntry>? wallPosts,
    bool? canModerateWall,
  }) {
    return PostListState(
      posts: posts ?? this.posts,
      nextCursor: clearCursor ? null : (nextCursor ?? this.nextCursor),
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
      wallPosts: wallPosts ?? this.wallPosts,
      canModerateWall: canModerateWall ?? this.canModerateWall,
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
        wallPosts: [...state.wallPosts, ...page.wallPosts],
        canModerateWall: page.canModerateWall,
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

  /// Update the status of a wall-post row (accept/hide). Hiding drops
  /// the row out of the local list; accepting flips the status in-
  /// place so the moderation chip disappears without a refetch.
  void updateWallStatus(String wallPostId, String status) {
    if (status == 'hidden') {
      state = state.copyWith(
        wallPosts: [
          for (final w in state.wallPosts)
            if (w.wallPostId != wallPostId) w,
        ],
      );
      return;
    }
    state = state.copyWith(
      wallPosts: [
        for (final w in state.wallPosts)
          if (w.wallPostId == wallPostId) w.copyWith(status: status) else w,
      ],
    );
  }

  /// Remove a wall-post row after it's been deleted by the wall owner.
  void removeWallPost(String wallPostId) {
    state = state.copyWith(
      wallPosts: [
        for (final w in state.wallPosts)
          if (w.wallPostId != wallPostId) w,
      ],
    );
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
