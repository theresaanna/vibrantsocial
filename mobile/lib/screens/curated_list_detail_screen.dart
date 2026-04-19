import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/curated_list.dart';
import '../widgets/themed_background.dart';
import '../widgets/themed_container.dart';
import '../providers.dart';
import 'curated_lists_screen.dart';
import 'curated_list_feed_screen.dart';
import 'profile_screen.dart';

final _detailProvider = FutureProvider.autoDispose
    .family<CuratedListDetail, String>((ref, listId) {
  return ref.watch(curatedListsApiProvider).fetchDetail(listId);
});

/// Detail page for a curated list: owner, member roster, and a CTA to
/// view the combined feed. Viewers who can subscribe see a toggle;
/// owners/collaborators see a member-count summary (member editing
/// lands in Phase 2).
class CuratedListDetailScreen extends ConsumerStatefulWidget {
  const CuratedListDetailScreen({super.key, required this.listId});

  final String listId;

  @override
  ConsumerState<CuratedListDetailScreen> createState() =>
      _CuratedListDetailScreenState();
}

class _CuratedListDetailScreenState
    extends ConsumerState<CuratedListDetailScreen> {
  bool _subBusy = false;
  bool? _optimisticSubscribed;

  Future<void> _toggleSubscribe(CuratedListDetail d) async {
    if (_subBusy) return;
    final currentlySubscribed = _optimisticSubscribed ?? d.role.isSubscribed;
    setState(() {
      _subBusy = true;
      _optimisticSubscribed = !currentlySubscribed;
    });
    final api = ref.read(curatedListsApiProvider);
    try {
      if (currentlySubscribed) {
        await api.unsubscribe(widget.listId);
      } else {
        await api.subscribe(widget.listId);
      }
      // Invalidate the overview so the lists index picks up the change
      // next time it's visited.
      ref.invalidate(_detailProvider(widget.listId));
    } catch (err) {
      setState(() => _optimisticSubscribed = currentlySubscribed);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Couldn\'t update subscription: $err')),
        );
      }
    } finally {
      if (mounted) setState(() => _subBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(_detailProvider(widget.listId));
    final viewerTheme = ref.watch(viewerThemeProvider);

    return ThemedBackground(
      theme: viewerTheme,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: detail.maybeWhen(
            data: (d) => Text(d.name),
            orElse: () => const Text('List'),
          ),
          backgroundColor: Colors.transparent,
        ),
        body: detail.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.error_outline, size: 48),
                  const SizedBox(height: 12),
                  Text('Couldn\'t load list.\n$e',
                      textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () =>
                        ref.invalidate(_detailProvider(widget.listId)),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
          data: (d) => _Body(
            detail: d,
            subscribed: _optimisticSubscribed ?? d.role.isSubscribed,
            subBusy: _subBusy,
            onToggleSubscribe: () => _toggleSubscribe(d),
            onOpenFeed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => CuratedListFeedScreen(
                  listId: d.id,
                  listName: d.name,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({
    required this.detail,
    required this.subscribed,
    required this.subBusy,
    required this.onToggleSubscribe,
    required this.onOpenFeed,
  });

  final CuratedListDetail detail;
  final bool subscribed;
  final bool subBusy;
  final VoidCallback onToggleSubscribe;
  final VoidCallback onOpenFeed;

  @override
  Widget build(BuildContext context) {
    final role = detail.role;
    final canViewFeed =
        role.canManage || role.isMember || subscribed || !detail.isPrivate;

    return ListView(
      children: [
        // Header card
        ThemedContainer(
          margin: const EdgeInsets.fromLTRB(12, 12, 12, 8),
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor:
                    const Color(0xFFD946EF).withValues(alpha: 0.15),
                child: Icon(
                  detail.isPrivate ? Icons.lock : Icons.playlist_play,
                  color: const Color(0xFFD946EF),
                  size: 32,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      detail.name,
                      style: Theme.of(context)
                          .textTheme
                          .titleLarge
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'by ${detail.owner.displayNameOrUsername}'
                      '${detail.isPrivate ? " · Private" : ""}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    Text(
                      '${detail.members.length} '
                      '${detail.members.length == 1 ? "member" : "members"}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        // Action row: View feed + Subscribe (non-owners/non-collabs)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              if (canViewFeed)
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onOpenFeed,
                    icon: const Icon(Icons.dynamic_feed),
                    label: const Text('View feed'),
                  ),
                ),
              if (canViewFeed && !role.isOwner && !role.isCollaborator)
                const SizedBox(width: 8),
              if (!role.isOwner && !role.isCollaborator)
                Expanded(
                  child: FilledButton.icon(
                    onPressed: subBusy ? null : onToggleSubscribe,
                    style: FilledButton.styleFrom(
                      backgroundColor: subscribed
                          ? Colors.grey.shade300
                          : const Color(0xFFD946EF),
                      foregroundColor:
                          subscribed ? Colors.black87 : Colors.white,
                    ),
                    icon: Icon(subscribed
                        ? Icons.notifications_active
                        : Icons.notifications_outlined),
                    label: Text(subscribed ? 'Subscribed' : 'Subscribe'),
                  ),
                ),
            ],
          ),
        ),

        const SizedBox(height: 16),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text('Members',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        ),
        const SizedBox(height: 4),

        if (detail.members.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Text('No members yet.'),
          )
        else
          for (final m in detail.members)
            ThemedContainer(
              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              padding: const EdgeInsets.symmetric(
                  horizontal: 12, vertical: 8),
              onTap: m.user.username == null
                  ? null
                  : () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) =>
                              ProfileScreen(username: m.user.username!),
                        ),
                      ),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundImage: m.user.avatarUrl != null
                        ? CachedNetworkImageProvider(m.user.avatarUrl!)
                        : null,
                    child: m.user.avatarUrl == null
                        ? const Icon(Icons.person)
                        : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          m.user.displayNameOrUsername,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (m.user.username != null)
                          Text(
                            '@${m.user.username}',
                            style: const TextStyle(fontSize: 12),
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

        const SizedBox(height: 32),
      ],
    );
  }
}
