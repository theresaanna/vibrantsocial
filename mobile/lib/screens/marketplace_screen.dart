import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/marketplace_api.dart';
import '../models/marketplace.dart';
import '../providers.dart';
import '../widgets/nsfw_toggle.dart';
import '../widgets/themed_background.dart';
import 'marketplace_detail_screen.dart';

final _marketplaceApiProvider = Provider<MarketplaceApi>(
  (ref) => MarketplaceApi(ref.watch(dioProvider)),
);

/// Two-column grid of marketplace listings, newest first. Matches the
/// web marketplace page's card layout: media tile, price badge, seller
/// overlay on the bottom.
class MarketplaceScreen extends ConsumerStatefulWidget {
  const MarketplaceScreen({super.key});

  @override
  ConsumerState<MarketplaceScreen> createState() => _MarketplaceScreenState();
}

class _MarketplaceScreenState extends ConsumerState<MarketplaceScreen> {
  final _scroll = ScrollController();
  final _posts = <MarketplacePost>[];
  String? _cursor;
  bool _loading = false;
  bool _exhausted = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _loadMore();
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    // Trigger the next page once the user is within 600px of the end —
    // gives the fetch time to resolve before they hit the placeholder.
    if (_scroll.position.pixels >=
        _scroll.position.maxScrollExtent - 600) {
      _loadMore();
    }
  }

  Future<void> _loadMore() async {
    if (_loading || _exhausted) return;
    setState(() => _loading = true);
    try {
      final page = await ref
          .read(_marketplaceApiProvider)
          .fetchPage(cursor: _cursor);
      setState(() {
        _posts.addAll(page.posts);
        _cursor = page.nextCursor;
        _exhausted = page.nextCursor == null;
        _error = null;
      });
    } catch (err) {
      setState(() => _error = err);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _refresh() async {
    setState(() {
      _posts.clear();
      _cursor = null;
      _exhausted = false;
      _error = null;
    });
    await _loadMore();
  }

  @override
  Widget build(BuildContext context) {
    final viewerTheme = ref.watch(viewerThemeProvider);

    return ThemedBackground(
      theme: viewerTheme,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text('Marketplace'),
          backgroundColor: Colors.transparent,
          actions: const [NsfwToggle()],
        ),
        body: RefreshIndicator(
          onRefresh: _refresh,
          child: _buildBody(),
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_error != null && _posts.isEmpty) {
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
                  Text('Couldn\'t load marketplace.\n$_error',
                      textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  FilledButton(onPressed: _refresh, child: const Text('Retry')),
                ],
              ),
            ),
          ),
        ],
      );
    }

    if (_posts.isEmpty && _loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_posts.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 120),
          Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text('No listings yet.'),
            ),
          ),
        ],
      );
    }

    return GridView.builder(
      controller: _scroll,
      padding: const EdgeInsets.all(8),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        childAspectRatio: 1,
      ),
      itemCount: _posts.length + (_exhausted ? 0 : 1),
      itemBuilder: (context, i) {
        if (i >= _posts.length) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: CircularProgressIndicator(),
            ),
          );
        }
        return _MarketplaceCard(post: _posts[i]);
      },
    );
  }
}

class _MarketplaceCard extends StatelessWidget {
  const _MarketplaceCard({required this.post});

  final MarketplacePost post;

  @override
  Widget build(BuildContext context) {
    final media = post.primaryMedia;

    return InkWell(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => MarketplaceDetailScreen(postId: post.id),
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Media tile or fallback
            if (media != null && (media.isImage || media.isYoutube))
              CachedNetworkImage(
                imageUrl: media.displayUrl,
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(color: Colors.black12),
                errorWidget: (_, __, ___) =>
                    const ColoredBox(color: Colors.black12),
              )
            else
              Container(
                color: Colors.black12,
                alignment: Alignment.center,
                child: const Icon(Icons.shopping_bag_outlined,
                    size: 40, color: Colors.black45),
              ),

            // Price badge — pink, top-left
            Positioned(
              top: 8,
              left: 8,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFD946EF),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  post.priceLabel,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ),
            ),

            // Seller bar — bottom gradient
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(8, 24, 8, 8),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Colors.black87],
                  ),
                ),
                child: Row(
                  children: [
                    if (post.author?.avatarUrl != null)
                      CircleAvatar(
                        radius: 10,
                        backgroundImage:
                            CachedNetworkImageProvider(post.author!.avatarUrl!),
                      )
                    else
                      const CircleAvatar(
                        radius: 10,
                        child: Icon(Icons.person, size: 12),
                      ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        post.author?.displayNameOrUsername ?? 'user',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
