import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/post.dart';
import '../providers.dart';
import '../screens/post_detail_screen.dart';
import '../screens/profile_screen.dart';
import '../screens/quote_compose_screen.dart';
import '../screens/tag_feed_screen.dart';
import 'block_renderer.dart';
import 'framed_avatar.dart';
import 'username_text.dart';

/// Post card painted as a rounded themed container. Uses the signed-in
/// viewer's theme colors so cards sit cohesively on top of the ambient
/// ThemedBackground.
///
/// [onMutate] lets the enclosing list replace this card's [post] in its
/// own state after an optimistic interaction — feeds and profile-posts
/// pages both take advantage of this to keep their loaded list in sync.
class PostCard extends ConsumerWidget {
  const PostCard({super.key, required this.post, this.onMutate});

  final Post post;
  final void Function(Post updated)? onMutate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final viewerTheme = ref.watch(viewerThemeProvider);
    final colors = viewerTheme?.colors;
    final opacity = viewerTheme?.container.opacity ?? 100;
    final containerColor = colors == null
        ? Theme.of(context).colorScheme.surface
        : colors.containerColor.withValues(alpha: opacity.clamp(0, 100) / 100.0);
    final textColor = colors?.textColor ?? Theme.of(context).colorScheme.onSurface;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Material(
        color: containerColor,
        borderRadius: BorderRadius.circular(16),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => PostDetailScreen(postId: post.id),
            ),
          ),
          child: DefaultTextStyle.merge(
            style: TextStyle(color: textColor),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _AuthorRow(post: post),
                  const SizedBox(height: 10),
                  // Server hard-filters NSFW / sensitive / graphic
                  // posts for every `/api/v1/*` request (Play policy),
                  // so nothing we receive needs a reveal gate — render
                  // the blocks directly.
                  BlockRenderer(blocks: post.blocks),
                  if (post.tags.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    _TagChips(tags: post.tags),
                  ],
                  const SizedBox(height: 10),
                  _CountsRow(
                    post: post,
                    onMutate: onMutate,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AuthorRow extends StatelessWidget {
  const _AuthorRow({required this.post});

  final Post post;

  @override
  Widget build(BuildContext context) {
    final author = post.author;
    return Row(
      children: [
        GestureDetector(
          onTap: author?.username == null
              ? null
              : () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => ProfileScreen(username: author!.username!),
                    ),
                  ),
          child: FramedAvatar(
            avatarUrl: author?.avatar,
            frame: author?.frame,
            size: 40,
          ),
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              UsernameText(
                text: author?.displayNameOrUsername ?? 'deleted user',
                fontFamily: author?.usernameFontFamily,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                _byline(post),
                style: const TextStyle(fontSize: 12),
              ),
            ],
          ),
        ),
        if (post.isPinned)
          const Padding(
            padding: EdgeInsets.only(left: 4),
            child: Icon(Icons.push_pin, size: 16),
          ),
      ],
    );
  }

  static String _byline(Post post) {
    final username = post.author?.username;
    final handle = username == null ? '' : '@$username · ';
    return '$handle${_relative(post.createdAt)}';
  }

  static String _relative(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
  }
}

class _CountsRow extends ConsumerWidget {
  const _CountsRow({required this.post, required this.onMutate});

  final Post post;
  final void Function(Post updated)? onMutate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final counts = post.counts;
    final viewer = post.viewerState;
    final style = const TextStyle(fontSize: 12);
    return Row(
      children: [
        _IconCount(
          icon: viewer.liked ? Icons.favorite : Icons.favorite_border,
          label: counts.likes,
          style: style,
          active: viewer.liked,
          activeColor: Colors.redAccent,
          onTap: () => _toggleLike(context, ref),
        ),
        const SizedBox(width: 20),
        _IconCount(
          icon: Icons.chat_bubble_outline,
          label: counts.comments,
          style: style,
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => PostDetailScreen(postId: post.id),
            ),
          ),
        ),
        const SizedBox(width: 20),
        _IconCount(
          icon: viewer.reposted ? Icons.repeat : Icons.repeat_outlined,
          label: counts.reposts,
          style: style,
          active: viewer.reposted,
          activeColor: Colors.green,
          onTap: () => _toggleRepost(context, ref),
          onLongPress: () => _showRepostMenu(context, ref),
        ),
        const SizedBox(width: 20),
        _IconCount(
          icon: viewer.bookmarked ? Icons.bookmark : Icons.bookmark_border,
          label: counts.bookmarks,
          style: style,
          active: viewer.bookmarked,
          onTap: () => _toggleBookmark(context, ref),
        ),
      ],
    );
  }

  Future<void> _toggleLike(BuildContext context, WidgetRef ref) async {
    final mutate = onMutate;
    if (mutate == null) return;
    final api = ref.read(interactionApiProvider);
    final wasLiked = post.viewerState.liked;
    // Optimistic: flip flag + adjust count.
    mutate(post.copyWith(
      viewerState: post.viewerState.copyWith(liked: !wasLiked),
      counts: post.counts.copyWith(
        likes: post.counts.likes + (wasLiked ? -1 : 1),
      ),
    ));
    try {
      final result = wasLiked ? await api.unlike(post.id) : await api.like(post.id);
      mutate(post.copyWith(
        viewerState: post.viewerState.copyWith(liked: result.liked),
        counts: post.counts.copyWith(likes: result.likes),
      ));
    } on DioException {
      // Revert on failure.
      mutate(post);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update like. Try again.')),
        );
      }
    }
  }

  /// Long-press affordance on the repost icon — matches Twitter/X
  /// convention: tap for straight repost, hold for the menu that lets
  /// the viewer pick between a plain repost and a quote.
  Future<void> _showRepostMenu(BuildContext context, WidgetRef ref) async {
    final wasReposted = post.viewerState.reposted;
    final choice = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: Icon(
                wasReposted ? Icons.undo : Icons.repeat,
                color: wasReposted ? null : Colors.green,
              ),
              title: Text(wasReposted ? 'Undo repost' : 'Repost'),
              onTap: () => Navigator.of(ctx).pop('repost'),
            ),
            ListTile(
              leading: const Icon(Icons.format_quote),
              title: const Text('Quote'),
              subtitle: const Text('Add your own text on top.'),
              // Quote-reposts are refused server-side after a straight
              // repost — save the round-trip by disabling here.
              enabled: !wasReposted,
              onTap: () => Navigator.of(ctx).pop('quote'),
            ),
            const SizedBox(height: 4),
          ],
        ),
      ),
    );
    if (choice == null || !context.mounted) return;
    switch (choice) {
      case 'repost':
        await _toggleRepost(context, ref);
        return;
      case 'quote':
        await _openQuoteCompose(context, ref);
        return;
    }
  }

  Future<void> _openQuoteCompose(BuildContext context, WidgetRef ref) async {
    final mutate = onMutate;
    final posted = await Navigator.of(context).push<bool?>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => QuoteComposeScreen(post: post),
      ),
    );
    // The server bumps the straight-repost count for quote-reposts
    // too, so reconcile the viewer's row if we had a mutator wired.
    // We don't flip `viewerState.reposted` — that flag tracks the
    // viewer's *straight* repost, which a quote didn't create.
    if (posted == true && mutate != null) {
      mutate(post.copyWith(
        counts: post.counts.copyWith(reposts: post.counts.reposts + 1),
      ));
    }
  }

  Future<void> _toggleRepost(BuildContext context, WidgetRef ref) async {
    final mutate = onMutate;
    if (mutate == null) return;
    final api = ref.read(interactionApiProvider);
    final wasReposted = post.viewerState.reposted;
    // Optimistic: flip flag + adjust count before the network round-trip.
    mutate(post.copyWith(
      viewerState: post.viewerState.copyWith(reposted: !wasReposted),
      counts: post.counts.copyWith(
        reposts: post.counts.reposts + (wasReposted ? -1 : 1),
      ),
    ));
    try {
      final result =
          wasReposted ? await api.unrepost(post.id) : await api.repost(post.id);
      mutate(post.copyWith(
        viewerState: post.viewerState.copyWith(reposted: result.reposted),
        counts: post.counts.copyWith(reposts: result.reposts),
      ));
    } on DioException {
      mutate(post);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update repost. Try again.')),
        );
      }
    }
  }

  Future<void> _toggleBookmark(BuildContext context, WidgetRef ref) async {
    final mutate = onMutate;
    if (mutate == null) return;
    final api = ref.read(interactionApiProvider);
    final wasBookmarked = post.viewerState.bookmarked;
    mutate(post.copyWith(
      viewerState: post.viewerState.copyWith(bookmarked: !wasBookmarked),
      counts: post.counts.copyWith(
        bookmarks: post.counts.bookmarks + (wasBookmarked ? -1 : 1),
      ),
    ));
    try {
      final result = wasBookmarked
          ? await api.unbookmark(post.id)
          : await api.bookmark(post.id);
      mutate(post.copyWith(
        viewerState: post.viewerState.copyWith(bookmarked: result.bookmarked),
        counts: post.counts.copyWith(bookmarks: result.bookmarks),
      ));
    } on DioException {
      mutate(post);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update bookmark. Try again.')),
        );
      }
    }
  }
}

class _IconCount extends StatelessWidget {
  const _IconCount({
    required this.icon,
    required this.label,
    required this.style,
    this.active = false,
    this.activeColor,
    this.onTap,
    this.onLongPress,
  });

  final IconData icon;
  final int label;
  final TextStyle style;
  final bool active;
  final Color? activeColor;
  final VoidCallback? onTap;

  /// Optional long-press handler. Used by the repost icon to surface
  /// the "Repost vs Quote" choice (matches Twitter/X convention).
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    final color = active ? activeColor : null;
    final child = Row(
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 4),
        Text('$label', style: style.copyWith(color: color)),
      ],
    );
    if (onTap == null && onLongPress == null) return child;
    return InkWell(
      onTap: onTap,
      onLongPress: onLongPress,
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
        child: child,
      ),
    );
  }
}

/// Wrap of `#tag` pills shown below the post body. Rendered whenever
/// the post has tags — these come as a flat `List<String>` off the
/// post record (distinct from inline hashtags in the body text, which
/// the block renderer already styles). Tapping a chip opens the
/// tag feed so the chip doubles as a discovery affordance.
class _TagChips extends StatelessWidget {
  const _TagChips({required this.tags});

  final List<String> tags;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final tag in tags)
          InkWell(
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => TagFeedScreen(tagName: tag),
              ),
            ),
            borderRadius: BorderRadius.circular(999),
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: scheme.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '#$tag',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: scheme.primary,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
