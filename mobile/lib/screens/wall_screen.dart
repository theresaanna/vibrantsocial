import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/wall_post.dart';
import '../providers.dart';
import '../widgets/post_card.dart';
import '../widgets/themed_background.dart';
import 'wall_compose_screen.dart';

/// Wall screen for `/@username` — shows accepted wall posts to
/// everyone; the wall owner additionally sees pending posts with
/// Accept / Hide affordances.
class WallScreen extends ConsumerStatefulWidget {
  const WallScreen({super.key, required this.username});

  final String username;

  @override
  ConsumerState<WallScreen> createState() => _WallScreenState();
}

class _WallScreenState extends ConsumerState<WallScreen> {
  final ScrollController _scroll = ScrollController();
  final List<WallPostEntry> _entries = [];

  String? _cursor;
  bool _canCompose = false;
  bool _canModerate = false;
  bool _loading = false;
  bool _exhausted = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _refresh();
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_loading || _exhausted) return;
    if (_scroll.position.extentAfter < 600) _loadMore();
  }

  Future<void> _refresh() async {
    setState(() {
      _entries.clear();
      _cursor = null;
      _exhausted = false;
      _error = null;
    });
    await _loadMore();
  }

  Future<void> _loadMore() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await ref
          .read(wallApiProvider)
          .fetchWall(widget.username, cursor: _cursor);
      if (!mounted) return;
      setState(() {
        _entries.addAll(page.posts);
        _cursor = page.nextCursor;
        _exhausted = page.nextCursor == null;
        _canCompose = page.canCompose;
        _canModerate = page.canModerate;
      });
    } catch (err) {
      if (!mounted) return;
      setState(() => _error = err);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _compose() async {
    final changed = await Navigator.of(context).push<bool?>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => WallComposeScreen(username: widget.username),
      ),
    );
    if (changed == true && mounted) _refresh();
  }

  Future<void> _setStatus(WallPostEntry entry, String status) async {
    try {
      await ref
          .read(wallApiProvider)
          .setStatus(wallPostId: entry.wallPostId, status: status);
      if (!mounted) return;
      if (status == 'hidden') {
        // Hidden posts shouldn't linger on the owner's list — remove.
        setState(() => _entries.removeWhere((e) => e.wallPostId == entry.wallPostId));
      } else {
        setState(() {
          final idx = _entries.indexWhere((e) => e.wallPostId == entry.wallPostId);
          if (idx >= 0) _entries[idx] = entry.copyWith(status: status);
        });
      }
    } on DioException catch (e) {
      if (mounted) _snack(_messageFromDio(e) ?? 'Update failed.');
    }
  }

  Future<void> _delete(WallPostEntry entry) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete wall post?'),
        content: const Text('This can\'t be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(wallApiProvider).deleteWallPost(entry.wallPostId);
      if (!mounted) return;
      setState(() => _entries.removeWhere((e) => e.wallPostId == entry.wallPostId));
    } on DioException catch (e) {
      if (mounted) _snack(_messageFromDio(e) ?? 'Delete failed.');
    }
  }

  void _snack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    // Paint the wall owner's theme as the backdrop — "visiting
    // someone's wall" should feel like being on their profile. Fall
    // back to the viewer's own theme while the profile fetch is in
    // flight (or if the owner has no custom theme).
    final ownerProfile = ref.watch(profileProvider(widget.username));
    final ownerTheme = ownerProfile.maybeWhen(
      data: (p) => p.theme,
      orElse: () => null,
    );
    final backdrop = ownerTheme ?? ref.watch(viewerThemeProvider);
    final appBarFg = backdrop?.colors.textColor;

    return ThemedBackground(
      theme: backdrop,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: Text('@${widget.username}\'s wall'),
          backgroundColor: Colors.transparent,
          elevation: 0,
          foregroundColor: appBarFg,
        ),
        floatingActionButton: _canCompose
            ? FloatingActionButton.extended(
                onPressed: _compose,
                icon: const Icon(Icons.edit),
                label: const Text('Write'),
              )
            : null,
        body: _body(),
      ),
    );
  }

  Widget _body() {
    if (_error != null && _entries.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48),
              const SizedBox(height: 12),
              Text('Couldn\'t load this wall.\n$_error',
                  textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(onPressed: _refresh, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }
    if (_entries.isEmpty && _loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_entries.isEmpty) {
      return RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          children: [
            const SizedBox(height: 120),
            Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  _canCompose
                      ? 'No wall posts yet. Tap Write to be the first.'
                      : 'No wall posts here yet.',
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ],
        ),
      );
    }
    final tail = !_exhausted ? 1 : 0;
    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView.separated(
        controller: _scroll,
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: _entries.length + tail,
        separatorBuilder: (_, _) => const SizedBox(height: 4),
        itemBuilder: (context, i) {
          if (i >= _entries.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          return _WallRow(
            entry: _entries[i],
            canModerate: _canModerate,
            onAccept: () => _setStatus(_entries[i], 'accepted'),
            onHide: () => _setStatus(_entries[i], 'hidden'),
            onDelete: () => _delete(_entries[i]),
          );
        },
      ),
    );
  }
}

class _WallRow extends StatelessWidget {
  const _WallRow({
    required this.entry,
    required this.canModerate,
    required this.onAccept,
    required this.onHide,
    required this.onDelete,
  });

  final WallPostEntry entry;
  final bool canModerate;
  final VoidCallback onAccept;
  final VoidCallback onHide;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (entry.isPending)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.amber.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: Colors.amber.withValues(alpha: 0.4),
                    ),
                  ),
                  child: const Text(
                    'Pending',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const Spacer(),
                if (canModerate) ...[
                  TextButton(
                    onPressed: onAccept,
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text('Accept'),
                  ),
                  TextButton(
                    onPressed: onHide,
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      foregroundColor: Theme.of(context).colorScheme.error,
                    ),
                    child: const Text('Hide'),
                  ),
                ],
              ],
            ),
          ),
        PostCard(post: entry.post, onMutate: null),
        if (canModerate)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: onDelete,
                icon: const Icon(Icons.delete_outline, size: 16),
                label: const Text('Delete'),
                style: TextButton.styleFrom(
                  foregroundColor: Theme.of(context).colorScheme.error,
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

String? _messageFromDio(DioException e) {
  final data = e.response?.data;
  if (data is Map && data['error'] is String) {
    return data['error'] as String;
  }
  return null;
}
