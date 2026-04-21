import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/explore_api.dart';
import '../models/post.dart';
import '../providers.dart';
import '../widgets/post_card.dart';

/// Single-tag feed. Reached from the tag cloud on [ExploreScreen] or
/// from a tag pill on [PostCard]. Server applies Play-policy filtering
/// (NSFW tags 404, posts run through `mobileSafePostFilter`) so this
/// screen only has to worry about pagination + UI state.
class TagFeedScreen extends ConsumerStatefulWidget {
  const TagFeedScreen({super.key, required this.tagName});

  final String tagName;

  @override
  ConsumerState<TagFeedScreen> createState() => _TagFeedScreenState();
}

class _TagFeedScreenState extends ConsumerState<TagFeedScreen> {
  final ScrollController _scroll = ScrollController();
  final List<Post> _posts = [];

  TagCloudEntry? _tag;
  String? _cursor;
  bool _loading = false;
  bool _exhausted = false;
  Object? _error;
  bool _notFound = false;

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
      _posts.clear();
      _cursor = null;
      _exhausted = false;
      _error = null;
      _notFound = false;
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
          .read(exploreApiProvider)
          .fetchTagFeed(widget.tagName, cursor: _cursor);
      if (!mounted) return;
      setState(() {
        _tag = page.tag;
        _posts.addAll(page.posts);
        _cursor = page.nextCursor;
        _exhausted = page.nextCursor == null;
      });
    } catch (err) {
      if (!mounted) return;
      // Dio surfaces the 404 we send for NSFW / unknown tags as a
      // DioException with statusCode == 404. Distinguish from network
      // errors so we can show a friendlier empty state.
      final isDio404 = err.toString().contains('404');
      setState(() {
        _notFound = isDio404;
        _error = err;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('#${widget.tagName}'),
        bottom: _tag == null
            ? null
            : PreferredSize(
                preferredSize: const Size.fromHeight(18),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(
                    '${_tag!.postCount} ${_tag!.postCount == 1 ? "post" : "posts"}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ),
      ),
      body: _body(),
    );
  }

  Widget _body() {
    if (_notFound) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            "We couldn't find that tag on mobile.",
            textAlign: TextAlign.center,
          ),
        ),
      );
    }
    if (_error != null && _posts.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48),
              const SizedBox(height: 12),
              Text(
                'Failed to load tag feed.\n${_error!}',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              FilledButton(onPressed: _refresh, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }
    if (_posts.isEmpty && _loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_posts.isEmpty) {
      return RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          children: const [
            SizedBox(height: 120),
            Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text('No posts with this tag yet.'),
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
        itemCount: _posts.length + tail,
        separatorBuilder: (_, _) => const SizedBox(height: 4),
        itemBuilder: (context, i) {
          if (i >= _posts.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          final post = _posts[i];
          return PostCard(
            post: post,
            onMutate: (updated) => setState(() => _posts[i] = updated),
          );
        },
      ),
    );
  }
}
