import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/post.dart';
import '../providers.dart';
import '../screens/post_detail_screen.dart';
import '../screens/profile_screen.dart';
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
                  _ContentGate(post: post),
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

class _ContentGate extends StatefulWidget {
  const _ContentGate({required this.post});
  final Post post;

  @override
  State<_ContentGate> createState() => _ContentGateState();
}

class _ContentGateState extends State<_ContentGate> {
  bool _revealed = false;

  @override
  Widget build(BuildContext context) {
    final post = widget.post;
    final isGated = post.isNsfw || post.isGraphicNudity || post.isSensitive;
    if (!isGated || _revealed) {
      return BlockRenderer(blocks: post.blocks);
    }
    return _warningShade(context, post);
  }

  Widget _warningShade(BuildContext context, Post post) {
    final label = post.isNsfw
        ? 'NSFW content'
        : post.isGraphicNudity
            ? 'Graphic content'
            : 'Sensitive content';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          const Icon(Icons.visibility_off),
          const SizedBox(height: 6),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => setState(() => _revealed = true),
            child: const Text('Show content'),
          ),
        ],
      ),
    );
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
          // Repost mutation lands in a later slice — icon stays inert.
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
  });

  final IconData icon;
  final int label;
  final TextStyle style;
  final bool active;
  final Color? activeColor;
  final VoidCallback? onTap;

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
    if (onTap == null) return child;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
        child: child,
      ),
    );
  }
}
