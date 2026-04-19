import 'block.dart';
import 'post.dart';

class Comment {
  Comment({
    required this.id,
    required this.content,
    required this.blocks,
    required this.imageUrl,
    required this.parentId,
    required this.createdAt,
    required this.editedAt,
    required this.author,
    required this.replyCount,
  });

  final String id;
  /// Plain-text fallback from the server. Prefer [blocks] for rendering.
  final String content;
  /// Structured rendering: linkified text, inline YouTube previews, and
  /// any attached image — same format as [Post.blocks].
  final List<Block> blocks;
  final String? imageUrl;
  final String? parentId;
  final DateTime createdAt;
  final DateTime? editedAt;
  final PostAuthor author;
  final int replyCount;

  factory Comment.fromJson(Map<String, dynamic> json) {
    return Comment(
      id: json['id'] as String,
      content: json['content'] as String,
      blocks: (json['blocks'] as List? ?? const [])
          .cast<Map>()
          .map((m) => Block.fromJson(m.cast<String, dynamic>()))
          .toList(),
      imageUrl: json['imageUrl'] as String?,
      parentId: json['parentId'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      editedAt: json['editedAt'] == null
          ? null
          : DateTime.parse(json['editedAt'] as String),
      author: PostAuthor.fromJson(
        (json['author'] as Map).cast<String, dynamic>(),
      ),
      replyCount: json['replyCount'] as int,
    );
  }
}

class CommentPage {
  CommentPage({required this.comments, required this.nextCursor});

  final List<Comment> comments;
  final String? nextCursor;

  factory CommentPage.fromJson(Map<String, dynamic> json) {
    return CommentPage(
      comments: (json['comments'] as List)
          .cast<Map>()
          .map((m) => Comment.fromJson(m.cast<String, dynamic>()))
          .toList(),
      nextCursor: json['nextCursor'] as String?,
    );
  }
}
