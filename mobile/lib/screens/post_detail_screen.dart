import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/comment.dart';
import '../models/post.dart';
import '../models/resolved_theme.dart';
import '../providers.dart';
import '../widgets/block_renderer.dart';
import '../widgets/framed_avatar.dart';
import '../widgets/post_card.dart';
import '../widgets/themed_background.dart';
import '../widgets/username_text.dart';
import 'profile_screen.dart';

class PostDetailScreen extends ConsumerWidget {
  const PostDetailScreen({super.key, required this.postId});

  final String postId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final postAsync = ref.watch(postProvider(postId));
    final viewerTheme = ref.watch(viewerThemeProvider);
    return ThemedBackground(
      theme: viewerTheme,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          title: const Text('Post'),
        ),
        body: postAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text('Could not load post: $err',
                  textAlign: TextAlign.center),
            ),
          ),
          data: (post) => _PostWithComments(post: post),
        ),
      ),
    );
  }
}

class _PostWithComments extends ConsumerStatefulWidget {
  const _PostWithComments({required this.post});
  final Post post;

  @override
  ConsumerState<_PostWithComments> createState() =>
      _PostWithCommentsState();
}

class _PostWithCommentsState extends ConsumerState<_PostWithComments> {
  late Post _post;
  final _commentCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _post = widget.post;
  }

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitComment() async {
    final text = _commentCtrl.text.trim();
    if (text.isEmpty || _submitting) return;
    setState(() => _submitting = true);
    try {
      await ref.read(interactionApiProvider).createComment(
            postId: _post.id,
            content: text,
          );
      _commentCtrl.clear();
      // Bump comment count locally so the post card reflects it immediately,
      // and refetch the comments list so the new row shows up.
      setState(() {
        _post = _post.copyWith(
          counts: _post.counts.copyWith(comments: _post.counts.comments + 1),
        );
      });
      ref.invalidate(commentsProvider(_post.id));
      // Also update any list controllers that happen to contain this post.
      ref.read(feedProvider.notifier).updatePost(_post.id, (_) => _post);
      final authorUsername = _post.author?.username;
      if (authorUsername != null) {
        ref
            .read(profilePostsProvider(authorUsername).notifier)
            .updatePost(_post.id, (_) => _post);
      }
    } on DioException catch (e) {
      if (!mounted) return;
      final msg = e.response?.data is Map
          ? ((e.response!.data as Map)['error']?.toString() ??
              'Could not post comment.')
          : 'Could not post comment.';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final commentsAsync = ref.watch(commentsProvider(_post.id));
    final viewerTheme = ref.watch(viewerThemeProvider);
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.symmetric(vertical: 8),
            children: [
              PostCard(
                post: _post,
                onMutate: (updated) => setState(() => _post = updated),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 6),
                child: Text(
                  'Comments',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
              commentsAsync.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (err, _) => Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text('Failed to load comments: $err'),
                ),
                data: (page) =>
                    _CommentsList(page: page, viewerTheme: viewerTheme),
              ),
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _commentCtrl,
                    minLines: 1,
                    maxLines: 4,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _submitComment(),
                    decoration: InputDecoration(
                      hintText: 'Write a comment…',
                      filled: true,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: _submitting ? null : _submitComment,
                  icon: _submitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _CommentsList extends StatelessWidget {
  const _CommentsList({required this.page, required this.viewerTheme});

  final CommentPage page;
  final ResolvedTheme? viewerTheme;

  @override
  Widget build(BuildContext context) {
    if (page.comments.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Text('No comments yet.'),
      );
    }
    return Column(
      children: [
        for (final c in page.comments)
          _CommentTile(comment: c, viewerTheme: viewerTheme),
        if (page.nextCursor != null)
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'More comments available — pagination lands in a later slice.',
              style: TextStyle(fontSize: 12),
              textAlign: TextAlign.center,
            ),
          ),
      ],
    );
  }
}

class _CommentTile extends StatelessWidget {
  const _CommentTile({required this.comment, required this.viewerTheme});

  final Comment comment;
  final ResolvedTheme? viewerTheme;

  @override
  Widget build(BuildContext context) {
    final author = comment.author;
    final colors = viewerTheme?.colors;
    final opacity = viewerTheme?.container.opacity ?? 100;
    final containerColor = colors == null
        ? Theme.of(context).colorScheme.surface
        : colors.containerColor.withValues(alpha: opacity.clamp(0, 100) / 100.0);
    final textColor = colors?.textColor ?? Theme.of(context).colorScheme.onSurface;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 4),
      child: Material(
        color: containerColor,
        borderRadius: BorderRadius.circular(14),
        child: DefaultTextStyle.merge(
          style: TextStyle(color: textColor),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
          GestureDetector(
            onTap: author.username == null
                ? null
                : () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) =>
                            ProfileScreen(username: author.username!),
                      ),
                    ),
            child: FramedAvatar(
              avatarUrl: author.avatar,
              frame: author.frame,
              size: 36,
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: UsernameText(
                        text: author.displayNameOrUsername,
                        fontFamily: author.usernameFontFamily,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (author.username != null)
                      Padding(
                        padding: const EdgeInsets.only(left: 6),
                        child: Text(
                          '@${author.username}',
                          style: const TextStyle(fontSize: 12),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                if (comment.blocks.isNotEmpty)
                  BlockRenderer(blocks: comment.blocks)
                else
                  Text(comment.content),
                if (comment.replyCount > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      '${comment.replyCount} ${comment.replyCount == 1 ? 'reply' : 'replies'}',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
              ],
            ),
          ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
