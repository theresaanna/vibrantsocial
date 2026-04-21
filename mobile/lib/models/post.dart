import 'avatar_frame.dart';
import 'block.dart';
import 'resolved_theme.dart';

class PostAuthor {
  PostAuthor({
    required this.id,
    required this.username,
    required this.displayName,
    required this.name,
    required this.avatar,
    required this.tier,
    required this.verified,
    required this.usernameFontFamily,
    required this.frame,
  });

  final String id;
  final String? username;
  final String? displayName;
  final String? name;
  final String? avatar;
  final String tier;
  final bool verified;
  final String? usernameFontFamily;
  final AvatarFrame? frame;

  String get displayNameOrUsername =>
      (displayName?.isNotEmpty ?? false)
          ? displayName!
          : (name?.isNotEmpty ?? false)
              ? name!
              : (username ?? 'user');

  factory PostAuthor.fromJson(Map<String, dynamic> json) {
    return PostAuthor(
      id: json['id'] as String,
      username: json['username'] as String?,
      displayName: json['displayName'] as String?,
      name: json['name'] as String?,
      avatar: json['avatar'] as String?,
      tier: json['tier'] as String,
      verified: json['verified'] as bool,
      usernameFontFamily: json['usernameFontFamily'] as String?,
      frame: json['frame'] == null
          ? null
          : AvatarFrame.fromJson(
              (json['frame'] as Map).cast<String, dynamic>(),
            ),
    );
  }
}

class PostCounts {
  PostCounts({
    required this.likes,
    required this.comments,
    required this.reposts,
    required this.bookmarks,
    required this.views,
  });

  final int likes;
  final int comments;
  final int reposts;
  final int bookmarks;
  final int views;

  PostCounts copyWith({
    int? likes,
    int? comments,
    int? reposts,
    int? bookmarks,
    int? views,
  }) {
    return PostCounts(
      likes: likes ?? this.likes,
      comments: comments ?? this.comments,
      reposts: reposts ?? this.reposts,
      bookmarks: bookmarks ?? this.bookmarks,
      views: views ?? this.views,
    );
  }

  factory PostCounts.fromJson(Map<String, dynamic> json) {
    return PostCounts(
      likes: json['likes'] as int,
      comments: json['comments'] as int,
      reposts: json['reposts'] as int,
      bookmarks: json['bookmarks'] as int,
      views: json['views'] as int,
    );
  }
}

class PostViewerState {
  PostViewerState({
    required this.liked,
    required this.bookmarked,
    required this.reposted,
    required this.pollVoteOptionId,
  });

  final bool liked;
  final bool bookmarked;
  final bool reposted;
  final String? pollVoteOptionId;

  PostViewerState copyWith({
    bool? liked,
    bool? bookmarked,
    bool? reposted,
    String? pollVoteOptionId,
    bool clearPollVote = false,
  }) {
    return PostViewerState(
      liked: liked ?? this.liked,
      bookmarked: bookmarked ?? this.bookmarked,
      reposted: reposted ?? this.reposted,
      pollVoteOptionId:
          clearPollVote ? null : (pollVoteOptionId ?? this.pollVoteOptionId),
    );
  }

  factory PostViewerState.fromJson(Map<String, dynamic> json) {
    return PostViewerState(
      liked: json['liked'] as bool,
      bookmarked: json['bookmarked'] as bool,
      reposted: json['reposted'] as bool,
      pollVoteOptionId: json['pollVoteOptionId'] as String?,
    );
  }
}

class Post {
  Post({
    required this.id,
    required this.slug,
    required this.author,
    required this.blocks,
    required this.isSensitive,
    required this.isNsfw,
    required this.isGraphicNudity,
    required this.isPinned,
    required this.createdAt,
    required this.editedAt,
    required this.counts,
    required this.tags,
    required this.viewerState,
  });

  final String id;
  final String? slug;
  final PostAuthor? author;
  final List<Block> blocks;
  final bool isSensitive;
  final bool isNsfw;
  final bool isGraphicNudity;
  final bool isPinned;
  final DateTime createdAt;
  final DateTime? editedAt;
  final PostCounts counts;
  final List<String> tags;
  final PostViewerState viewerState;

  Post copyWith({PostCounts? counts, PostViewerState? viewerState}) {
    return Post(
      id: id,
      slug: slug,
      author: author,
      blocks: blocks,
      isSensitive: isSensitive,
      isNsfw: isNsfw,
      isGraphicNudity: isGraphicNudity,
      isPinned: isPinned,
      createdAt: createdAt,
      editedAt: editedAt,
      counts: counts ?? this.counts,
      tags: tags,
      viewerState: viewerState ?? this.viewerState,
    );
  }

  factory Post.fromJson(Map<String, dynamic> json) {
    return Post(
      id: json['id'] as String,
      slug: json['slug'] as String?,
      author: json['author'] == null
          ? null
          : PostAuthor.fromJson(
              (json['author'] as Map).cast<String, dynamic>(),
            ),
      blocks: (json['blocks'] as List)
          .cast<Map>()
          .map((m) => Block.fromJson(m.cast<String, dynamic>()))
          .toList(),
      isSensitive: json['isSensitive'] as bool,
      isNsfw: json['isNsfw'] as bool,
      isGraphicNudity: json['isGraphicNudity'] as bool,
      isPinned: json['isPinned'] as bool,
      createdAt: DateTime.parse(json['createdAt'] as String),
      editedAt: json['editedAt'] == null
          ? null
          : DateTime.parse(json['editedAt'] as String),
      counts: PostCounts.fromJson(
        (json['counts'] as Map).cast<String, dynamic>(),
      ),
      tags: (json['tags'] as List).cast<String>(),
      viewerState: PostViewerState.fromJson(
        (json['viewerState'] as Map).cast<String, dynamic>(),
      ),
    );
  }
}

class PostPage {
  PostPage({required this.posts, required this.nextCursor});

  final List<Post> posts;
  final String? nextCursor;

  factory PostPage.fromJson(Map<String, dynamic> json) {
    return PostPage(
      posts: (json['posts'] as List)
          .cast<Map>()
          .map((m) => Post.fromJson(m.cast<String, dynamic>()))
          .toList(),
      nextCursor: json['nextCursor'] as String?,
    );
  }
}

/// Response shape for `GET /api/v1/post/:id` — the post itself plus the
/// author's resolved theme so the detail screen can paint the same
/// backdrop as the author's profile page.
class PostDetail {
  const PostDetail({required this.post, required this.authorTheme});

  final Post post;
  final ResolvedTheme? authorTheme;

  factory PostDetail.fromJson(Map<String, dynamic> json) {
    final rawTheme = json['authorTheme'];
    return PostDetail(
      post: Post.fromJson((json['post'] as Map).cast<String, dynamic>()),
      authorTheme: rawTheme is Map
          ? ResolvedTheme.fromJson(rawTheme.cast<String, dynamic>())
          : null,
    );
  }

  /// Keeps viewer-state mutations (like/bookmark toggles) working even
  /// when a caller only has the PostDetail wrapper.
  PostDetail copyWith({Post? post}) {
    return PostDetail(post: post ?? this.post, authorTheme: authorTheme);
  }
}
