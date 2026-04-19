import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/curated_lists_api.dart';
import '../models/curated_list.dart';
import '../providers.dart';
import '../widgets/themed_background.dart';
import '../widgets/themed_container.dart';
import 'curated_list_detail_screen.dart';

final curatedListsApiProvider = Provider<CuratedListsApi>(
  (ref) => CuratedListsApi(ref.watch(dioProvider)),
);

final _overviewProvider =
    FutureProvider.autoDispose<CuratedListOverview>((ref) {
  return ref.watch(curatedListsApiProvider).fetchOverview();
});

/// Index of the viewer's curated lists: lists they own, lists they help
/// manage as a collaborator, and lists they subscribe to.
class CuratedListsScreen extends ConsumerWidget {
  const CuratedListsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overview = ref.watch(_overviewProvider);
    final viewerTheme = ref.watch(viewerThemeProvider);

    return ThemedBackground(
      theme: viewerTheme,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text('Lists'),
          backgroundColor: Colors.transparent,
        ),
        body: overview.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => _ErrorView(
            error: e,
            onRetry: () => ref.invalidate(_overviewProvider),
          ),
          data: (data) => RefreshIndicator(
            onRefresh: () async => ref.refresh(_overviewProvider.future),
            child: _OverviewBody(data: data),
          ),
        ),
      ),
    );
  }
}

class _OverviewBody extends StatelessWidget {
  const _OverviewBody({required this.data});

  final CuratedListOverview data;

  @override
  Widget build(BuildContext context) {
    final allEmpty = data.owned.isEmpty &&
        data.collaborating.isEmpty &&
        data.subscribed.isEmpty;

    if (allEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 120),
          Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Column(
                children: [
                  Icon(Icons.playlist_add_check, size: 48),
                  SizedBox(height: 12),
                  Text(
                    'You don\'t own or follow any lists yet.\n'
                    'Lists let you curate a group of accounts and '
                    'share the combined feed.',
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    }

    return ListView(
      children: [
        if (data.owned.isNotEmpty) _Section(title: 'Your lists', items: data.owned),
        if (data.collaborating.isNotEmpty)
          _Section(title: 'Collaborating on', items: data.collaborating),
        if (data.subscribed.isNotEmpty)
          _Section(title: 'Subscribed', items: data.subscribed),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.items});

  final String title;
  final List<CuratedListCard> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(
            title,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
          ),
        ),
        for (final l in items) _ListTile(list: l),
        const SizedBox(height: 8),
      ],
    );
  }
}

class _ListTile extends StatelessWidget {
  const _ListTile({required this.list});

  final CuratedListCard list;

  @override
  Widget build(BuildContext context) {
    final subtitleParts = <String>[
      '${list.memberCount} ${list.memberCount == 1 ? 'member' : 'members'}',
      if (list.isPrivate) 'Private',
      if (list.ownerUsername != null) 'by @${list.ownerUsername}',
    ];
    return ThemedContainer(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => CuratedListDetailScreen(listId: list.id),
        ),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: const Color(0xFFD946EF).withValues(alpha: 0.15),
            child: Icon(
              list.isPrivate ? Icons.lock : Icons.playlist_play,
              color: const Color(0xFFD946EF),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  list.name,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  subtitleParts.join(' · '),
                  style: const TextStyle(fontSize: 12),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right),
        ],
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
            Text('Couldn\'t load lists.\n$error',
                textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
