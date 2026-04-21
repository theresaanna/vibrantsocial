import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/post.dart';
import '../providers.dart';
import '../widgets/block_renderer.dart';
import '../widgets/framed_avatar.dart';
import '../widgets/themed_background.dart';
import '../widgets/username_text.dart';

/// Compact composer for a quote-repost. Shows the original post as a
/// preview card underneath a multi-line text input; submit POSTs the
/// typed content plus the post id to `/api/v1/post/:id/quote-repost`.
///
/// Returns `true` on successful post so the caller (post card) can
/// bump its repost count locally.
class QuoteComposeScreen extends ConsumerStatefulWidget {
  const QuoteComposeScreen({super.key, required this.post});

  /// The post being quoted. Rendered as a non-interactive preview so
  /// the author can see what they're quoting without leaving.
  final Post post;

  @override
  ConsumerState<QuoteComposeScreen> createState() => _QuoteComposeScreenState();
}

class _QuoteComposeScreenState extends ConsumerState<QuoteComposeScreen> {
  final _ctrl = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  bool get _canSubmit => _ctrl.text.trim().isNotEmpty && !_busy;

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(interactionApiProvider).quoteRepost(
            postId: widget.post.id,
            content: _ctrl.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Posted quote')),
      );
    } on DioException catch (e) {
      if (!mounted) return;
      final msg = e.response?.data is Map
          ? ((e.response!.data as Map)['error']?.toString() ??
              'Could not post. Try again.')
          : 'Could not post. Try again.';
      setState(() => _error = msg);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewerTheme = ref.watch(viewerThemeProvider);
    final textColor = viewerTheme?.colors.textColor;
    return ThemedBackground(
      theme: viewerTheme,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text('Quote post'),
          backgroundColor: Colors.transparent,
          foregroundColor: textColor,
          actions: [
            TextButton(
              onPressed: _canSubmit ? _submit : null,
              child: _busy
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Post'),
            ),
          ],
        ),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _ctrl,
                  autofocus: true,
                  minLines: 3,
                  maxLines: 8,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    hintText: 'Add your thoughts…',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                _QuotedPreview(post: widget.post),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                      fontSize: 13,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Non-interactive card showing the post being quoted. Deliberately
/// strips the action row (like/repost/bookmark/comment) so the
/// composer can't recursively open engagement UI.
class _QuotedPreview extends StatelessWidget {
  const _QuotedPreview({required this.post});

  final Post post;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final author = post.author;
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: scheme.outlineVariant),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              FramedAvatar(
                avatarUrl: author?.avatar,
                frame: author?.frame,
                size: 32,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: UsernameText(
                  text: author?.displayNameOrUsername ?? 'deleted user',
                  fontFamily: author?.usernameFontFamily,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          BlockRenderer(blocks: post.blocks),
        ],
      ),
    );
  }
}
