import 'post.dart';

/// One wall-post row: the underlying Post plus the wall-attachment
/// status so the UI can show "pending" badges and moderation actions
/// on the wall owner's own profile.
class WallPostEntry {
  const WallPostEntry({
    required this.wallPostId,
    required this.status,
    required this.createdAt,
    required this.post,
  });

  /// Id of the `WallPost` row (not the underlying `Post.id`). Use this
  /// for PATCH-status and DELETE calls.
  final String wallPostId;

  /// "pending" | "accepted" | "hidden". The server never returns
  /// "hidden" to non-owners, so the client can safely treat "hidden"
  /// as an owner-only state.
  final String status;

  final DateTime createdAt;
  final Post post;

  bool get isPending => status == 'pending';
  bool get isAccepted => status == 'accepted';
  bool get isHidden => status == 'hidden';

  factory WallPostEntry.fromJson(Map<String, dynamic> json) => WallPostEntry(
        wallPostId: json['wallPostId'] as String,
        status: json['status'] as String? ?? 'accepted',
        createdAt: DateTime.parse(json['createdAt'] as String),
        post: Post.fromJson((json['post'] as Map).cast<String, dynamic>()),
      );

  WallPostEntry copyWith({String? status, Post? post}) => WallPostEntry(
        wallPostId: wallPostId,
        status: status ?? this.status,
        createdAt: createdAt,
        post: post ?? this.post,
      );
}

/// Page payload for `GET /api/v1/profile/:username/wall`. The role
/// flags tell the client which buttons to render — never compute
/// these locally, the server is the source of truth.
class WallPostPage {
  const WallPostPage({
    required this.posts,
    required this.nextCursor,
    required this.canCompose,
    required this.canModerate,
  });

  final List<WallPostEntry> posts;
  final String? nextCursor;

  /// True when the viewer is allowed to write on this wall (friends-
  /// only rule; never true on the viewer's own profile).
  final bool canCompose;

  /// True when the viewer owns this wall (can accept/hide pending
  /// posts, delete any post on their wall).
  final bool canModerate;

  factory WallPostPage.fromJson(Map<String, dynamic> json) {
    final role = (json['role'] as Map?)?.cast<String, dynamic>() ?? const {};
    return WallPostPage(
      posts: (json['posts'] as List)
          .cast<Map>()
          .map((m) => WallPostEntry.fromJson(m.cast<String, dynamic>()))
          .toList(),
      nextCursor: json['nextCursor'] as String?,
      canCompose: role['canCompose'] == true,
      canModerate: role['canModerate'] == true,
    );
  }
}
