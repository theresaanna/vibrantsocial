import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controllers/post_list_controller.dart';
import '../providers.dart';
import '../widgets/media_grid.dart';
import '../widgets/post_card.dart';
import '../widgets/view_mode_toggle.dart';

/// Authenticated home feed with a Posts ↔ Media view toggle pinned at
/// the top. Posts mode infinite-scrolls the timeline; Media mode shows
/// a 3-column grid of media-bearing posts (server-side filter).
class FeedScreen extends ConsumerStatefulWidget {
  const FeedScreen({super.key});

  @override
  ConsumerState<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends ConsumerState<FeedScreen> {
  late final ScrollController _postsScrollCtrl;
  late final ScrollController _mediaScrollCtrl;
  FeedViewMode _mode = FeedViewMode.posts;

  @override
  void initState() {
    super.initState();
    _postsScrollCtrl = ScrollController()..addListener(_onPostsScroll);
    _mediaScrollCtrl = ScrollController()..addListener(_onMediaScroll);
  }

  @override
  void dispose() {
    _postsScrollCtrl.removeListener(_onPostsScroll);
    _postsScrollCtrl.dispose();
    _mediaScrollCtrl.removeListener(_onMediaScroll);
    _mediaScrollCtrl.dispose();
    super.dispose();
  }

  void _onPostsScroll() {
    if (!_postsScrollCtrl.hasClients) return;
    final pos = _postsScrollCtrl.position;
    if (pos.pixels > pos.maxScrollExtent - 600) {
      ref.read(feedProvider.notifier).loadMore();
    }
  }

  void _onMediaScroll() {
    if (!_mediaScrollCtrl.hasClients) return;
    final pos = _mediaScrollCtrl.position;
    if (pos.pixels > pos.maxScrollExtent - 600) {
      ref.read(mediaFeedProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ViewModeToggle(
          mode: _mode,
          onChanged: (m) => setState(() => _mode = m),
        ),
        Expanded(
          child: _mode == FeedViewMode.posts
              ? _buildPostsView()
              : _buildMediaView(),
        ),
      ],
    );
  }

  Widget _buildPostsView() {
    final state = ref.watch(feedProvider);
    return RefreshIndicator(
      onRefresh: () => ref.read(feedProvider.notifier).refresh(),
      child: _postsBody(state),
    );
  }

  Widget _buildMediaView() {
    final state = ref.watch(mediaFeedProvider);
    return RefreshIndicator(
      onRefresh: () => ref.read(mediaFeedProvider.notifier).refresh(),
      child: MediaGrid(
        state: state,
        loadMore: () => ref.read(mediaFeedProvider.notifier).loadMore(),
        scrollController: _mediaScrollCtrl,
      ),
    );
  }

  Widget _postsBody(PostListState state) {
    if (state.posts.isEmpty) {
      if (state.isLoadingMore) {
        return const Center(child: CircularProgressIndicator());
      }
      if (state.error != null) {
        return _ErrorState(
          error: state.error!,
          onRetry: () => ref.read(feedProvider.notifier).loadMore(),
        );
      }
      return const _EmptyState();
    }
    final tail = state.isLoadingMore || state.error != null ? 1 : 0;
    return ListView.separated(
      controller: _postsScrollCtrl,
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: state.posts.length + tail,
      separatorBuilder: (_, _) => const SizedBox(height: 4),
      itemBuilder: (context, index) {
        if (index >= state.posts.length) {
          return state.error != null
              ? _ErrorTile(
                  error: state.error!,
                  onRetry: () => ref.read(feedProvider.notifier).loadMore(),
                )
              : const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Center(child: CircularProgressIndicator()),
                );
        }
        final post = state.posts[index];
        return PostCard(
          post: post,
          onMutate: (updated) => ref
              .read(feedProvider.notifier)
              .updatePost(post.id, (_) => updated),
        );
      },
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: const [
        SizedBox(height: 120),
        Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'No posts in your feed yet.\nFollow people to fill it in.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ],
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.error, required this.onRetry});
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
            Text('Could not load: $error', textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

class _ErrorTile extends StatelessWidget {
  const _ErrorTile({required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text('Failed to load more: $error'),
      trailing: TextButton(onPressed: onRetry, child: const Text('Retry')),
    );
  }
}
