// Dart mirror of `src/lib/lexical-blocks.ts#Block`. Post bodies arrive
// as a list of structured blocks so the client never walks a Lexical
// tree itself.

sealed class Segment {
  const Segment({required this.text});
  final String text;

  factory Segment.fromJson(Map<String, dynamic> json) {
    switch (json['type']) {
      case 'link':
        return LinkSegment(text: json['text'] as String, url: json['url'] as String);
      case 'mention':
        return MentionSegment(
          text: json['text'] as String,
          username: json['username'] as String,
        );
      case 'hashtag':
        return HashtagSegment(
          text: json['text'] as String,
          tag: json['tag'] as String,
        );
      case 'text':
      default:
        return TextSegment(
          text: json['text'] as String,
          bold: json['bold'] as bool? ?? false,
          italic: json['italic'] as bool? ?? false,
        );
    }
  }
}

class TextSegment extends Segment {
  const TextSegment({
    required super.text,
    this.bold = false,
    this.italic = false,
  });
  final bool bold;
  final bool italic;
}

class LinkSegment extends Segment {
  const LinkSegment({required super.text, required this.url});
  final String url;
}

class MentionSegment extends Segment {
  const MentionSegment({required super.text, required this.username});
  final String username;
}

class HashtagSegment extends Segment {
  const HashtagSegment({required super.text, required this.tag});
  final String tag;
}

sealed class Block {
  const Block();

  factory Block.fromJson(Map<String, dynamic> json) {
    switch (json['type']) {
      case 'paragraph':
        return ParagraphBlock(segments: _parseSegments(json['segments']));
      case 'heading':
        return HeadingBlock(
          level: json['level'] as int,
          segments: _parseSegments(json['segments']),
        );
      case 'list':
        return ListBlock(
          style: json['style'] == 'number' ? ListStyle.number : ListStyle.bullet,
          items: (json['items'] as List)
              .cast<List>()
              .map((raw) => raw
                  .cast<Map>()
                  .map((m) => Segment.fromJson(m.cast<String, dynamic>()))
                  .toList())
              .toList(),
        );
      case 'image':
        return ImageBlock(
          url: json['url'] as String,
          altText: json['altText'] as String?,
          caption: json['caption'] as String?,
        );
      case 'youtube':
        return YouTubeBlock(
          videoId: json['videoId'] as String,
          thumbnailUrl: json['thumbnailUrl'] as String,
        );
      case 'link_preview':
        return LinkPreviewBlock(
          url: json['url'] as String,
          title: json['title'] as String?,
          description: json['description'] as String?,
          image: json['image'] as String?,
        );
      case 'poll':
        return PollBlock(
          question: json['question'] as String,
          options: (json['options'] as List)
              .cast<Map>()
              .map((m) => PollOption.fromJson(m.cast<String, dynamic>()))
              .toList(),
          totalVotes: json['totalVotes'] as int,
          viewerVoteOptionId: json['viewerVoteOptionId'] as String?,
          expiresAt: json['expiresAt'] == null
              ? null
              : DateTime.parse(json['expiresAt'] as String),
        );
      default:
        return UnknownBlock(rawType: json['type']?.toString() ?? '');
    }
  }
}

List<Segment> _parseSegments(dynamic raw) {
  return (raw as List)
      .cast<Map>()
      .map((m) => Segment.fromJson(m.cast<String, dynamic>()))
      .toList();
}

class ParagraphBlock extends Block {
  const ParagraphBlock({required this.segments});
  final List<Segment> segments;
}

class HeadingBlock extends Block {
  const HeadingBlock({required this.level, required this.segments});
  final int level;
  final List<Segment> segments;
}

enum ListStyle { bullet, number }

class ListBlock extends Block {
  const ListBlock({required this.style, required this.items});
  final ListStyle style;
  final List<List<Segment>> items;
}

class ImageBlock extends Block {
  const ImageBlock({required this.url, this.altText, this.caption});
  final String url;
  final String? altText;
  final String? caption;
}

class YouTubeBlock extends Block {
  const YouTubeBlock({required this.videoId, required this.thumbnailUrl});
  final String videoId;
  final String thumbnailUrl;

  String get watchUrl => 'https://www.youtube.com/watch?v=$videoId';
}

class LinkPreviewBlock extends Block {
  const LinkPreviewBlock({
    required this.url,
    this.title,
    this.description,
    this.image,
  });
  final String url;
  final String? title;
  final String? description;
  final String? image;
}

class PollOption {
  PollOption({required this.id, required this.text, required this.votes});
  final String id;
  final String text;
  final int votes;

  factory PollOption.fromJson(Map<String, dynamic> json) {
    return PollOption(
      id: json['id'] as String,
      text: json['text'] as String,
      votes: json['votes'] as int,
    );
  }
}

class PollBlock extends Block {
  const PollBlock({
    required this.question,
    required this.options,
    required this.totalVotes,
    required this.viewerVoteOptionId,
    required this.expiresAt,
  });
  final String question;
  final List<PollOption> options;
  final int totalVotes;
  final String? viewerVoteOptionId;
  final DateTime? expiresAt;
}

class UnknownBlock extends Block {
  const UnknownBlock({required this.rawType});
  final String rawType;
}
