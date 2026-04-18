/// Media items extracted server-side from a post's Lexical JSON body.
/// Mirrors `MediaItem` in `src/lib/lexical-text.ts`.
class MediaItem {
  MediaItem({
    required this.type,
    required this.src,
    this.altText,
    this.videoID,
  });

  /// One of "image", "video", "youtube".
  final String type;
  final String src;
  final String? altText;
  final String? videoID;

  bool get isImage => type == 'image';
  bool get isVideo => type == 'video';
  bool get isYoutube => type == 'youtube';

  /// Best thumbnail URL — for YouTube we use the standard hqdefault
  /// asset; for images and videos we just render `src`.
  String get displayUrl {
    if (isYoutube && videoID != null) {
      return 'https://img.youtube.com/vi/$videoID/hqdefault.jpg';
    }
    return src;
  }

  factory MediaItem.fromJson(Map<String, dynamic> json) {
    return MediaItem(
      type: json['type'] as String,
      src: json['src'] as String,
      altText: json['altText'] as String?,
      videoID: json['videoID'] as String?,
    );
  }
}

/// A post stripped down to what the media grid needs: id (for navigating
/// to the detail view), author (overlay on hover), and its media items.
class MediaPost {
  MediaPost({
    required this.id,
    required this.slug,
    required this.createdAt,
    required this.author,
    required this.mediaItems,
  });

  final String id;
  final String? slug;
  final DateTime createdAt;
  final MediaPostAuthor? author;
  final List<MediaItem> mediaItems;

  factory MediaPost.fromJson(Map<String, dynamic> json) {
    return MediaPost(
      id: json['id'] as String,
      slug: json['slug'] as String?,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      author: json['author'] is Map
          ? MediaPostAuthor.fromJson(
              (json['author'] as Map).cast<String, dynamic>())
          : null,
      mediaItems: (json['mediaItems'] as List? ?? const [])
          .map((m) => MediaItem.fromJson((m as Map).cast<String, dynamic>()))
          .toList(),
    );
  }
}

class MediaPostAuthor {
  MediaPostAuthor({
    required this.id,
    required this.username,
    required this.displayName,
    required this.avatar,
  });

  final String id;
  final String? username;
  final String? displayName;
  final String? avatar;

  factory MediaPostAuthor.fromJson(Map<String, dynamic> json) {
    return MediaPostAuthor(
      id: json['id'] as String,
      username: json['username'] as String?,
      displayName: json['displayName'] as String? ?? json['name'] as String?,
      avatar: (json['avatar'] ?? json['image']) as String?,
    );
  }
}

class MediaPostPage {
  MediaPostPage({required this.posts, required this.hasMore, required this.nextCursor});

  final List<MediaPost> posts;
  final bool hasMore;
  final String? nextCursor;

  factory MediaPostPage.fromJson(Map<String, dynamic> json) {
    return MediaPostPage(
      posts: (json['posts'] as List? ?? const [])
          .map((p) => MediaPost.fromJson((p as Map).cast<String, dynamic>()))
          .toList(),
      hasMore: json['hasMore'] as bool? ?? false,
      nextCursor: json['nextCursor'] as String?,
    );
  }
}
