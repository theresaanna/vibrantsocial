import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/explore_api.dart';
import '../providers.dart';
import '../widgets/themed_container.dart';
import 'tag_feed_screen.dart';

/// Explore surface for the mobile app — lands users on a dense tag
/// cloud sorted by post count. NSFW tags are filtered out server-side
/// (Play policy); no client-side filtering needed.
class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  static const _pageSize = 50;

  final List<TagCloudEntry> _tags = [];
  final ScrollController _scroll = ScrollController();
  bool _loading = false;
  bool _exhausted = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_maybeLoadMore);
    // initState can't await — defer the initial load to the next frame
    // so `ref.read` sees a fully-mounted widget.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _refresh();
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _maybeLoadMore() {
    if (_loading || _exhausted) return;
    // Start fetching when we're within 300px of the bottom so the next
    // page is ready by the time the user gets there.
    if (_scroll.position.extentAfter < 300) {
      _loadMore();
    }
  }

  Future<void> _refresh() async {
    setState(() {
      _tags.clear();
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
      final page = await ref.read(exploreApiProvider).fetchTrendingTags(
            offset: _tags.length,
            limit: _pageSize,
          );
      if (!mounted) return;
      setState(() {
        _tags.addAll(page.tags);
        _exhausted = !page.hasMore;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null && _tags.isEmpty) {
      return _ErrorView(error: _error!, onRetry: _refresh);
    }
    if (_tags.isEmpty && _loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_tags.isEmpty) {
      return RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          children: const [
            SizedBox(height: 140),
            Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'No tags yet. Pull to refresh.',
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView(
        controller: _scroll,
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
        children: [
          ThemedContainer(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Trending tags',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [for (final tag in _tags) _TagPill(tag: tag)],
                ),
              ],
            ),
          ),
          if (!_exhausted)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator()),
            ),
        ],
      ),
    );
  }
}

/// Single pill in the cloud. Size scales gently with post count so
/// hot tags read larger without overwhelming the layout — think
/// "word cloud lite", not full typographic size range.
class _TagPill extends StatelessWidget {
  const _TagPill({required this.tag});

  final TagCloudEntry tag;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    // Bucket post counts into tiers so we don't need a linear
    // mapping — 1 / 2 / 10 / 50+ posts give a visible progression.
    final font = switch (tag.postCount) {
      >= 50 => 18.0,
      >= 10 => 15.0,
      >= 2 => 13.0,
      _ => 12.0,
    };
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => TagFeedScreen(tagName: tag.name)),
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: scheme.primary.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '#${tag.name}',
              style: TextStyle(
                fontSize: font,
                fontWeight: FontWeight.w600,
                color: scheme.primary,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              '${tag.postCount}',
              style: TextStyle(
                fontSize: font - 2,
                color: scheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48),
            const SizedBox(height: 12),
            Text('Couldn\'t load Explore.\n$error', textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
