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

/// Index of curated lists with a "My lists" / "Everyone's lists"
/// toggle matching the web. My-lists shows owned + collaborating +
/// subscribed sections; Everyone's-lists is a paginated discovery
/// feed of all public lists.
class CuratedListsScreen extends ConsumerStatefulWidget {
  const CuratedListsScreen({super.key});

  @override
  ConsumerState<CuratedListsScreen> createState() =>
      _CuratedListsScreenState();
}

enum _ListsTab { mine, everyone }

class _CuratedListsScreenState extends ConsumerState<CuratedListsScreen> {
  _ListsTab _tab = _ListsTab.mine;

  @override
  Widget build(BuildContext context) {
    final viewerTheme = ref.watch(viewerThemeProvider);

    return ThemedBackground(
      theme: viewerTheme,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text('Lists'),
          backgroundColor: Colors.transparent,
        ),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
              child: SegmentedButton<_ListsTab>(
                segments: const [
                  ButtonSegment(
                    value: _ListsTab.mine,
                    icon: Icon(Icons.person_outline),
                    label: Text('My lists'),
                  ),
                  ButtonSegment(
                    value: _ListsTab.everyone,
                    icon: Icon(Icons.public),
                    label: Text("Everyone's"),
                  ),
                ],
                selected: {_tab},
                onSelectionChanged: (s) => setState(() => _tab = s.first),
              ),
            ),
            Expanded(
              child: _tab == _ListsTab.mine
                  ? const _MyLists()
                  : const _EveryoneLists(),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── My lists ────────────────────────────────────────────────────────

class _MyLists extends ConsumerWidget {
  const _MyLists();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overview = ref.watch(_overviewProvider);
    return overview.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => _ErrorView(
        error: e,
        onRetry: () => ref.invalidate(_overviewProvider),
      ),
      data: (data) => RefreshIndicator(
        onRefresh: () async => ref.refresh(_overviewProvider.future),
        child: _MyListsBody(data: data),
      ),
    );
  }
}

class _MyListsBody extends StatelessWidget {
  const _MyListsBody({required this.data});

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
                    'Browse "Everyone\'s" to find and subscribe.',
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
        if (data.owned.isNotEmpty)
          _Section(title: 'Your lists', items: data.owned),
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

// ─── Everyone's lists (paginated discovery) ─────────────────────────

class _EveryoneLists extends ConsumerStatefulWidget {
  const _EveryoneLists();

  @override
  ConsumerState<_EveryoneLists> createState() => _EveryoneListsState();
}

class _EveryoneListsState extends ConsumerState<_EveryoneLists> {
  final _scroll = ScrollController();
  final _items = <CuratedListCard>[];
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
          .read(curatedListsApiProvider)
          .fetchAll(cursor: _cursor);
      setState(() {
        _items.addAll(page.lists);
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
      _items.clear();
      _cursor = null;
      _exhausted = false;
      _error = null;
    });
    await _loadMore();
  }

  @override
  Widget build(BuildContext context) {
    // NSFW lists are hard-filtered server-side for mobile callers
    // (Play policy) — no client-side filter needed.
    if (_error != null && _items.isEmpty) {
      return _ErrorView(error: _error!, onRetry: _refresh);
    }
    if (_items.isEmpty && _loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_items.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 120),
          Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text('No public lists yet.'),
            ),
          ),
        ],
      );
    }
    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView.builder(
        controller: _scroll,
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: _items.length + (_exhausted ? 0 : 1),
        itemBuilder: (context, i) {
          if (i >= _items.length) {
            return const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          return _ListTile(list: _items[i]);
        },
      ),
    );
  }
}

// ─── Shared tile ────────────────────────────────────────────────────

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
