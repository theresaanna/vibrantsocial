import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controllers/post_list_controller.dart';
import '../providers.dart';
import '../widgets/post_card.dart';
import '../widgets/themed_background.dart';

/// Paginated list of posts authored by a single user. Reachable via the
/// `posts` count on the profile screen. Shares the [PostListController]
/// shape with the feed; paginates via scroll-listener.
class UserPostsScreen extends ConsumerStatefulWidget {
  const UserPostsScreen({super.key, required this.username});

  final String username;

  @override
  ConsumerState<UserPostsScreen> createState() => _UserPostsScreenState();
}

class _UserPostsScreenState extends ConsumerState<UserPostsScreen> {
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
      ref.read(profilePostsProvider(widget.username).notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(profilePostsProvider(widget.username));
    final viewerTheme = ref.watch(viewerThemeProvider);
    return ThemedBackground(
      theme: viewerTheme,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          title: Text('Posts · @${widget.username}'),
        ),
        body: RefreshIndicator(
          onRefresh: () => ref
              .read(profilePostsProvider(widget.username).notifier)
              .refresh(),
          child: _body(state),
        ),
      ),
    );
  }

  Widget _body(PostListState state) {
    if (state.posts.isEmpty) {
      if (state.isLoadingMore) {
        return const Center(child: CircularProgressIndicator());
      }
      if (state.error != null) {
        return Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Could not load posts: ${state.error}',
                textAlign: TextAlign.center),
          ),
        );
      }
      return const Center(child: Text('No posts yet.'));
    }
    final tail = state.isLoadingMore ? 1 : 0;
    return ListView.separated(
      controller: _scrollCtrl,
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: state.posts.length + tail,
      separatorBuilder: (_, _) => const SizedBox(height: 4),
      itemBuilder: (context, index) {
        if (index >= state.posts.length) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(child: CircularProgressIndicator()),
          );
        }
        final post = state.posts[index];
        return PostCard(
          post: post,
          onMutate: (updated) => ref
              .read(profilePostsProvider(widget.username).notifier)
              .updatePost(post.id, (_) => updated),
        );
      },
    );
  }
}
