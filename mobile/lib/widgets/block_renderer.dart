import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/block.dart';
import '../screens/profile_screen.dart';

/// Renders a list of post-body [Block]s as a column of widgets. Taps on
/// link / mention / hashtag / YouTube / link-preview surfaces trigger the
/// expected navigation or external launch. Poll blocks are read-only
/// today — voting lands with the interactions slice.
class BlockRenderer extends StatelessWidget {
  const BlockRenderer({super.key, required this.blocks});

  final List<Block> blocks;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final block in blocks)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: _buildBlock(context, block),
          ),
      ],
    );
  }

  Widget _buildBlock(BuildContext context, Block block) {
    switch (block) {
      case ParagraphBlock():
        return _SegmentText(segments: block.segments);
      case HeadingBlock():
        final scale = switch (block.level) {
          1 => 1.4,
          2 => 1.25,
          _ => 1.1,
        };
        return _SegmentText(
          segments: block.segments,
          baseStyle: Theme.of(context).textTheme.bodyLarge!.copyWith(
                fontWeight: FontWeight.w700,
                fontSize: 16 * scale,
                height: 1.3,
              ),
        );
      case ListBlock():
        return _ListBlockView(block: block);
      case ImageBlock():
        return _ImageBlockView(block: block);
      case YouTubeBlock():
        return _YouTubeBlockView(block: block);
      case LinkPreviewBlock():
        return _LinkPreviewView(block: block);
      case PollBlock():
        return _PollBlockView(block: block);
      case UnknownBlock():
        return const SizedBox.shrink();
    }
  }
}

class _SegmentText extends StatelessWidget {
  const _SegmentText({required this.segments, this.baseStyle});

  final List<Segment> segments;
  final TextStyle? baseStyle;

  @override
  Widget build(BuildContext context) {
    final defaultStyle =
        baseStyle ?? const TextStyle(fontSize: 15, height: 1.45);
    final linkColor = Theme.of(context).colorScheme.primary;
    final spans = <InlineSpan>[];
    for (final seg in segments) {
      spans.add(_spanFor(context, seg, linkColor));
    }
    return Text.rich(
      TextSpan(children: spans),
      style: defaultStyle,
    );
  }

  InlineSpan _spanFor(BuildContext context, Segment seg, Color linkColor) {
    switch (seg) {
      case TextSegment():
        return TextSpan(
          text: seg.text,
          style: TextStyle(
            fontWeight: seg.bold ? FontWeight.w700 : FontWeight.w400,
            fontStyle: seg.italic ? FontStyle.italic : FontStyle.normal,
          ),
        );
      case LinkSegment():
        return TextSpan(
          text: seg.text,
          style: TextStyle(
            color: linkColor,
            decoration: TextDecoration.underline,
            decorationColor: linkColor,
          ),
          recognizer: TapGestureRecognizer()
            ..onTap = () => _launchExternal(seg.url),
        );
      case MentionSegment():
        return TextSpan(
          text: seg.text,
          style: TextStyle(color: linkColor, fontWeight: FontWeight.w600),
          recognizer: TapGestureRecognizer()
            ..onTap = () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ProfileScreen(username: seg.username),
                  ),
                ),
        );
      case HashtagSegment():
        return TextSpan(
          text: seg.text,
          style: TextStyle(color: linkColor, fontWeight: FontWeight.w600),
          // Tag-detail screen lands in a later slice; for now, tapping
          // hashtags is inert but visually distinct.
        );
    }
  }
}

class _ListBlockView extends StatelessWidget {
  const _ListBlockView({required this.block});

  final ListBlock block;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < block.items.length; i++)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 24,
                  child: Text(
                    block.style == ListStyle.bullet ? '•' : '${i + 1}.',
                    style: const TextStyle(fontSize: 15, height: 1.45),
                  ),
                ),
                Expanded(child: _SegmentText(segments: block.items[i])),
              ],
            ),
          ),
      ],
    );
  }
}

class _ImageBlockView extends StatelessWidget {
  const _ImageBlockView({required this.block});

  final ImageBlock block;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: CachedNetworkImage(
        imageUrl: block.url,
        fit: BoxFit.cover,
        errorWidget: (_, _, _) => Container(
          height: 200,
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          alignment: Alignment.center,
          child: const Icon(Icons.broken_image, size: 40),
        ),
      ),
    );
  }
}

class _YouTubeBlockView extends StatelessWidget {
  const _YouTubeBlockView({required this.block});

  final YouTubeBlock block;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _launchExternal(block.watchUrl),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: AspectRatio(
          aspectRatio: 16 / 9,
          child: Stack(
            alignment: Alignment.center,
            children: [
              CachedNetworkImage(
                imageUrl: block.thumbnailUrl,
                fit: BoxFit.cover,
                width: double.infinity,
                errorWidget: (_, _, _) => Container(
                  color: Colors.black12,
                  alignment: Alignment.center,
                  child: const Icon(Icons.videocam, size: 40),
                ),
              ),
              Container(
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.6),
                  shape: BoxShape.circle,
                ),
                padding: const EdgeInsets.all(14),
                child: const Icon(
                  Icons.play_arrow,
                  size: 32,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LinkPreviewView extends StatelessWidget {
  const _LinkPreviewView({required this.block});

  final LinkPreviewBlock block;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return InkWell(
      onTap: () => _launchExternal(block.url),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: scheme.outlineVariant),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (block.image != null)
              ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(12),
                ),
                child: AspectRatio(
                  aspectRatio: 1.9,
                  child: CachedNetworkImage(
                    imageUrl: block.image!,
                    fit: BoxFit.cover,
                    width: double.infinity,
                    errorWidget: (_, _, _) => const SizedBox.shrink(),
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (block.title != null && block.title!.isNotEmpty)
                    Text(
                      block.title!,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  if (block.description != null && block.description!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        block.description!,
                        style: TextStyle(
                          fontSize: 12,
                          color: scheme.onSurfaceVariant,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      _hostOf(block.url) ?? block.url,
                      style: TextStyle(
                        fontSize: 11,
                        color: scheme.primary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PollBlockView extends StatelessWidget {
  const _PollBlockView({required this.block});

  final PollBlock block;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final hasVoted = block.viewerVoteOptionId != null;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            block.question,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
          ),
          const SizedBox(height: 10),
          for (final option in block.options)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: _PollOptionRow(
                option: option,
                totalVotes: block.totalVotes,
                viewerSelected: option.id == block.viewerVoteOptionId,
                showResults: hasVoted,
              ),
            ),
          if (!hasVoted)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Voting opens in a later build.',
                style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                '${block.totalVotes} vote${block.totalVotes == 1 ? '' : 's'}',
                style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant),
              ),
            ),
        ],
      ),
    );
  }
}

class _PollOptionRow extends StatelessWidget {
  const _PollOptionRow({
    required this.option,
    required this.totalVotes,
    required this.viewerSelected,
    required this.showResults,
  });

  final PollOption option;
  final int totalVotes;
  final bool viewerSelected;
  final bool showResults;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final pct = totalVotes == 0 ? 0.0 : option.votes / totalVotes;
    return Stack(
      children: [
        if (showResults)
          Positioned.fill(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: pct.clamp(0.0, 1.0),
                child: Container(
                  color: viewerSelected
                      ? scheme.primary.withValues(alpha: 0.3)
                      : scheme.primary.withValues(alpha: 0.12),
                ),
              ),
            ),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  option.text,
                  style: TextStyle(
                    fontWeight:
                        viewerSelected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ),
              if (showResults)
                Text(
                  '${(pct * 100).round()}%',
                  style: const TextStyle(fontSize: 12),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

Future<void> _launchExternal(String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null) return;
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

String? _hostOf(String url) {
  try {
    return Uri.parse(url).host;
  } catch (_) {
    return null;
  }
}
