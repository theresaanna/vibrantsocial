import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controllers/post_list_controller.dart';
import '../providers.dart';
import '../widgets/post_card.dart';

/// Authenticated home feed. Pulls from [feedProvider]; infinite-scrolls
/// new pages as the user nears the bottom of the list.
class FeedScreen extends ConsumerStatefulWidget {
  const FeedScreen({super.key});

  @override
  ConsumerState<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends ConsumerState<FeedScreen> {
  late final ScrollController _scrollCtrl;

  @override
  void initState() {
    super.initState();
    _scrollCtrl = ScrollController()..addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollCtrl.removeListener(_onScroll);
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollCtrl.hasClients) return;
    final pos = _scrollCtrl.position;
    if (pos.pixels > pos.maxScrollExtent - 600) {
      ref.read(feedProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(feedProvider);
    return RefreshIndicator(
      onRefresh: () => ref.read(feedProvider.notifier).refresh(),
      child: _body(state),
    );
  }

  Widget _body(PostListState state) {
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
      controller: _scrollCtrl,
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
