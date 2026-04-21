import 'package:dio/dio.dart';

import '../models/comment.dart';

/// Response shape for `/api/v1/post/:id/like` (POST or DELETE).
class LikeResult {
  LikeResult({required this.liked, required this.likes});
  final bool liked;
  final int likes;

  factory LikeResult.fromJson(Map<String, dynamic> json) => LikeResult(
        liked: json['liked'] as bool,
        likes: json['likes'] as int,
      );
}

/// Response shape for `/api/v1/post/:id/bookmark` (POST or DELETE).
class BookmarkResult {
  BookmarkResult({required this.bookmarked, required this.bookmarks});
  final bool bookmarked;
  final int bookmarks;

  factory BookmarkResult.fromJson(Map<String, dynamic> json) => BookmarkResult(
        bookmarked: json['bookmarked'] as bool,
        bookmarks: json['bookmarks'] as int,
      );
}

/// Response shape for `/api/v1/post/:id/repost` (POST or DELETE).
class RepostResult {
  RepostResult({required this.reposted, required this.reposts});
  final bool reposted;
  final int reposts;

  factory RepostResult.fromJson(Map<String, dynamic> json) => RepostResult(
        reposted: json['reposted'] as bool,
        reposts: json['reposts'] as int,
      );
}

/// Response shape for `/api/v1/profile/:username/follow` (POST or DELETE).
class FollowResult {
  FollowResult({required this.isFollowing, required this.followers});
  final bool isFollowing;
  final int followers;

  factory FollowResult.fromJson(Map<String, dynamic> json) => FollowResult(
        isFollowing: json['isFollowing'] as bool,
        followers: json['followers'] as int,
      );
}

/// Response shape for `/api/v1/profile/:username/friend` mutations.
class FriendStatus {
  FriendStatus({
    required this.isFriend,
    required this.friendRequestOutgoing,
    required this.friendRequestIncoming,
    required this.friends,
  });

  final bool isFriend;
  final bool friendRequestOutgoing;
  final bool friendRequestIncoming;
  final int friends;

  factory FriendStatus.fromJson(Map<String, dynamic> json) => FriendStatus(
        isFriend: json['isFriend'] as bool,
        friendRequestOutgoing: json['friendRequestOutgoing'] as bool,
        friendRequestIncoming: json['friendRequestIncoming'] as bool,
        friends: json['friends'] as int,
      );
}

/// Collection of mutation endpoints — likes, bookmarks, comment create,
/// follow, friend request. Kept separate from the read-side PostApi so
/// read provider signatures don't pull in mutation types.
class InteractionApi {
  InteractionApi(this._dio);

  final Dio _dio;

  Future<LikeResult> like(String postId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/v1/post/${Uri.encodeComponent(postId)}/like',
    );
    return LikeResult.fromJson(_body(res));
  }

  Future<LikeResult> unlike(String postId) async {
    final res = await _dio.delete<Map<String, dynamic>>(
      '/api/v1/post/${Uri.encodeComponent(postId)}/like',
    );
    return LikeResult.fromJson(_body(res));
  }

  Future<BookmarkResult> bookmark(String postId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/v1/post/${Uri.encodeComponent(postId)}/bookmark',
    );
    return BookmarkResult.fromJson(_body(res));
  }

  Future<BookmarkResult> unbookmark(String postId) async {
    final res = await _dio.delete<Map<String, dynamic>>(
      '/api/v1/post/${Uri.encodeComponent(postId)}/bookmark',
    );
    return BookmarkResult.fromJson(_body(res));
  }

  Future<RepostResult> repost(String postId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/v1/post/${Uri.encodeComponent(postId)}/repost',
    );
    return RepostResult.fromJson(_body(res));
  }

  Future<RepostResult> unrepost(String postId) async {
    final res = await _dio.delete<Map<String, dynamic>>(
      '/api/v1/post/${Uri.encodeComponent(postId)}/repost',
    );
    return RepostResult.fromJson(_body(res));
  }

  /// Create a quote-repost — a repost with the viewer's own `content`
  /// attached. Server refuses if the viewer has already straight-
  /// reposted this post (keeps feeds from showing both). Returns the
  /// fresh straight-repost count so the UI can reconcile the row
  /// alongside the `reposted` flag it just flipped.
  Future<RepostResult> quoteRepost({
    required String postId,
    required String content,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/v1/post/${Uri.encodeComponent(postId)}/quote-repost',
      data: {'content': content},
    );
    final data = _body(res);
    return RepostResult(
      // Server returns `{ok, repostId, reposts}` — synthesize `reposted`
      // as `true` so callers treat the row the same as a straight repost
      // for UI state.
      reposted: true,
      reposts: (data['reposts'] as num).toInt(),
    );
  }

  /// Create a top-level comment on [postId].
  Future<Comment> createComment({
    required String postId,
    required String content,
    String? imageUrl,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/v1/post/${Uri.encodeComponent(postId)}/comments',
      data: {
        'content': content,
        'imageUrl': ?imageUrl,
      },
    );
    final body = _body(res);
    return Comment.fromJson((body['comment'] as Map).cast<String, dynamic>());
  }

  Future<FollowResult> follow(String username) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/v1/profile/${Uri.encodeComponent(username)}/follow',
    );
    return FollowResult.fromJson(_body(res));
  }

  Future<FollowResult> unfollow(String username) async {
    final res = await _dio.delete<Map<String, dynamic>>(
      '/api/v1/profile/${Uri.encodeComponent(username)}/follow',
    );
    return FollowResult.fromJson(_body(res));
  }

  /// Send (or accept-if-incoming) a friend request. The server handles
  /// the symmetric case where the target already sent us a PENDING
  /// request — in that case this call acts as an acceptance.
  Future<FriendStatus> friendSendOrAccept(String username) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/v1/profile/${Uri.encodeComponent(username)}/friend',
    );
    return FriendStatus.fromJson(_body(res));
  }

  /// Cancel an outgoing PENDING request OR remove an accepted friendship.
  Future<FriendStatus> friendRemove(String username) async {
    final res = await _dio.delete<Map<String, dynamic>>(
      '/api/v1/profile/${Uri.encodeComponent(username)}/friend',
    );
    return FriendStatus.fromJson(_body(res));
  }

  Map<String, dynamic> _body(Response<Map<String, dynamic>> res) {
    final data = res.data;
    if (data == null) {
      throw DioException(
        requestOptions: res.requestOptions,
        response: res,
        message: 'Empty response body',
      );
    }
    return data;
  }
}
