import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../controllers/media_list_controller.dart';
import '../models/media.dart';
import '../screens/post_detail_screen.dart';

/// Three-column square-aspect media grid. Tapping a tile opens the
/// underlying post in [PostDetailScreen]. Mirrors `media-grid.tsx`
/// (3 cols mobile, 1px gap, aspect-square, object-cover).
///
/// Takes the [state] and a [loadMore] callback rather than the provider
/// directly — Riverpod's auto-dispose vs always-alive provider variants
/// don't share a public base type, so the call site does the wiring.
class MediaGrid extends StatelessWidget {
  const MediaGrid({
    super.key,
    required this.state,
    required this.loadMore,
    this.scrollController,
    this.shrinkWrap = false,
    this.physics,
  });

  final MediaListState state;
  final VoidCallback loadMore;
  final ScrollController? scrollController;
  final bool shrinkWrap;
  final ScrollPhysics? physics;

  @override
  Widget build(BuildContext context) {
    if (state.posts.isEmpty) {
      if (state.isLoadingMore) {
        return const Center(child: CircularProgressIndicator());
      }
      if (state.error != null) {
        return Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Could not load: ${state.error}', textAlign: TextAlign.center),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: loadMore,
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        );
      }
      return const Center(child: Text('No media yet.'));
    }

    // Flatten to one tile per media item — a post with three images
    // contributes three tiles. Track the source post on each tile.
    final tiles = <_GridTile>[];
    for (final post in state.posts) {
      for (final item in post.mediaItems) {
        tiles.add(_GridTile(post: post, item: item));
      }
    }
    final loadingTail = state.hasMore || state.isLoadingMore;

    return GridView.builder(
      controller: scrollController,
      shrinkWrap: shrinkWrap,
      physics: physics,
      padding: const EdgeInsets.all(1),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 1,
        mainAxisSpacing: 1,
        childAspectRatio: 1,
      ),
      itemCount: tiles.length + (loadingTail ? 3 : 0),
      itemBuilder: (context, index) {
        if (index >= tiles.length) {
          return const ColoredBox(
            color: Colors.black12,
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          );
        }
        final tile = tiles[index];
        return InkWell(
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => PostDetailScreen(postId: tile.post.id),
            ),
          ),
          child: Stack(
            fit: StackFit.expand,
            children: [
              CachedNetworkImage(
                imageUrl: tile.item.displayUrl,
                fit: BoxFit.cover,
                placeholder: (_, _) => const ColoredBox(color: Colors.black12),
                errorWidget: (_, _, _) =>
                    const ColoredBox(color: Colors.black26),
              ),
              if (tile.item.isVideo || tile.item.isYoutube)
                const Positioned(
                  right: 4,
                  bottom: 4,
                  child: Icon(
                    Icons.play_circle,
                    color: Colors.white,
                    size: 22,
                    shadows: [Shadow(color: Colors.black45, blurRadius: 4)],
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _GridTile {
  _GridTile({required this.post, required this.item});
  final MediaPost post;
  final MediaItem item;
}
