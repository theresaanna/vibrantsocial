import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controllers/post_list_controller.dart';
import '../providers.dart';
import '../widgets/post_card.dart';
import '../widgets/themed_background.dart';
import 'curated_lists_screen.dart';

/// Feed of posts authored by a curated list's members. Reuses the same
/// `PostListController` that powers the home feed; the only difference
/// is the fetcher points at `/api/v1/lists/:id/feed`.
final curatedListFeedProvider = StateNotifierProvider.autoDispose
    .family<PostListController, PostListState, String>((ref, listId) {
  final api = ref.watch(curatedListsApiProvider);
  return PostListController((cursor) => api.fetchFeed(listId, cursor: cursor));
});

class CuratedListFeedScreen extends ConsumerStatefulWidget {
  const CuratedListFeedScreen({
    super.key,
    required this.listId,
    required this.listName,
  });

  final String listId;
  final String listName;

  @override
  ConsumerState<CuratedListFeedScreen> createState() =>
      _CuratedListFeedScreenState();
}

class _CuratedListFeedScreenState extends ConsumerState<CuratedListFeedScreen> {
  late final ScrollController _scroll;

  @override
  void initState() {
    super.initState();
    _scroll = ScrollController()..addListener(_onScroll);
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    final pos = _scroll.position;
    if (pos.pixels > pos.maxScrollExtent - 600) {
      ref.read(curatedListFeedProvider(widget.listId).notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(curatedListFeedProvider(widget.listId));
    final notifier =
        ref.read(curatedListFeedProvider(widget.listId).notifier);
    final viewerTheme = ref.watch(viewerThemeProvider);

    return ThemedBackground(
      theme: viewerTheme,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: Text(widget.listName),
          backgroundColor: Colors.transparent,
        ),
        body: RefreshIndicator(
          onRefresh: () async {
            // Resetting via state copy isn't supported — the simplest
            // refresh is to invalidate the family entry so Riverpod
            // rebuilds the controller from scratch.
            ref.invalidate(curatedListFeedProvider(widget.listId));
          },
          child: _buildBody(state, notifier),
        ),
      ),
    );
  }

  Widget _buildBody(PostListState state, PostListController notifier) {
    if (state.error != null && state.posts.isEmpty) {
      return ListView(
        children: [
          const SizedBox(height: 120),
          Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  const Icon(Icons.error_outline, size: 48),
                  const SizedBox(height: 12),
                  Text('Couldn\'t load feed.\n${state.error}',
                      textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () => notifier.loadMore(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    }

    if (state.posts.isEmpty && state.isLoadingMore) {
      return const Center(child: CircularProgressIndicator());
    }

    if (state.posts.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 120),
          Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text('No posts from this list yet.'),
            ),
          ),
        ],
      );
    }

    return ListView.builder(
      controller: _scroll,
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: state.posts.length + (state.hasMore ? 1 : 0),
      itemBuilder: (context, i) {
        if (i >= state.posts.length) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(child: CircularProgressIndicator()),
          );
        }
        final post = state.posts[i];
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: PostCard(
            post: post,
            onMutate: (updated) => notifier.updatePost(post.id, (_) => updated),
          ),
        );
      },
    );
  }
}
