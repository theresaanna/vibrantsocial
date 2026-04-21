import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/profile_api.dart';
import '../controllers/profile_list_controller.dart';
import '../models/user_list.dart';
import '../providers.dart';
import '../widgets/framed_avatar.dart';
import '../widgets/themed_background.dart';
import '../widgets/themed_container.dart';
import '../widgets/username_text.dart';
import 'profile_screen.dart';

/// Shared scrollable user list backing the followers / following / friends
/// surfaces. Paginates via [ProfileListController]; tapping a row pushes
/// that user's [ProfileScreen].
class UserListScreen extends ConsumerStatefulWidget {
  const UserListScreen({
    super.key,
    required this.username,
    required this.kind,
  });

  final String username;
  final ProfileListKind kind;

  @override
  ConsumerState<UserListScreen> createState() => _UserListScreenState();
}

class _UserListScreenState extends ConsumerState<UserListScreen> {
  late final ScrollController _scrollCtrl;
  late final ProfileListKey _key;

  @override
  void initState() {
    super.initState();
    _key = ProfileListKey(username: widget.username, kind: widget.kind);
    _scrollCtrl = ScrollController()..addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollCtrl.removeListener(_onScroll);
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    // Prefetch once the user has ~400px of list left.
    if (!_scrollCtrl.hasClients) return;
    final position = _scrollCtrl.position;
    if (position.pixels > position.maxScrollExtent - 400) {
      ref.read(profileListProvider(_key).notifier).loadMore();
    }
  }

  String get _title {
    switch (widget.kind) {
      case ProfileListKind.followers:
        return 'Followers';
      case ProfileListKind.following:
        return 'Following';
      case ProfileListKind.friends:
        return 'Friends';
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(profileListProvider(_key));
    final viewerTheme = ref.watch(viewerThemeProvider);
    return ThemedBackground(
      theme: viewerTheme,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          title: Text('$_title · @${widget.username}'),
        ),
        body: RefreshIndicator(
          onRefresh: () =>
              ref.read(profileListProvider(_key).notifier).refresh(),
          child: _buildBody(context, state),
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context, ProfileListState state) {
    if (state.users.isEmpty) {
      if (state.isLoadingMore) {
        return const Center(child: CircularProgressIndicator());
      }
      if (state.error != null) {
        return _ErrorState(
          error: state.error!,
          onRetry: () =>
              ref.read(profileListProvider(_key).notifier).loadMore(),
        );
      }
      return Center(
        child: Text(
          'No $_title yet.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      );
    }

    final tailCount = state.isLoadingMore || state.error != null ? 1 : 0;
    return ListView.builder(
      controller: _scrollCtrl,
      padding: const EdgeInsets.symmetric(vertical: 4),
      itemCount: state.users.length + tailCount,
      itemBuilder: (context, index) {
        if (index >= state.users.length) {
          return state.error != null
              ? _ErrorTile(
                  error: state.error!,
                  onRetry: () =>
                      ref.read(profileListProvider(_key).notifier).loadMore(),
                )
              : const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Center(child: CircularProgressIndicator()),
                );
        }
        return _UserRow(user: state.users[index]);
      },
    );
  }
}

class _UserRow extends StatelessWidget {
  const _UserRow({required this.user});

  final UserListEntry user;

  @override
  Widget build(BuildContext context) {
    return ThemedContainer(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      onTap: user.username == null
          ? null
          : () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => ProfileScreen(username: user.username!),
                ),
              ),
      child: Row(
        children: [
          FramedAvatar(
            avatarUrl: user.avatar,
            frame: user.frame,
            size: 44,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: UsernameText(
                        text: user.displayNameOrUsername,
                        fontFamily: user.usernameFontFamily,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (user.tier == 'premium')
                      Padding(
                        padding: const EdgeInsets.only(left: 6),
                        child: Icon(
                          Icons.workspace_premium,
                          size: 16,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                      ),
                  ],
                ),
                if (user.username != null)
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '@${user.username}',
                          style: const TextStyle(fontSize: 12),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (user.isFriend)
                        const _Tag(label: 'friend')
                      else if (user.isFollowing)
                        const _Tag(label: 'following')
                      else if (user.isSelf)
                        const _Tag(label: 'you'),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
      ),
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
