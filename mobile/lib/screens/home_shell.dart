import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import '../services/ably_service.dart';
import '../widgets/nsfw_toggle.dart';
import '../widgets/themed_background.dart';
import 'chatrooms_screen.dart';
import 'compose_screen.dart';
import 'curated_lists_screen.dart';
import 'explore_screen.dart';
import 'feed_screen.dart';
import 'marketplace_screen.dart';
import 'messages_screen.dart';
import 'profile_screen.dart';
import 'theme_edit_screen.dart';

/// Four-tab authenticated shell: Feed, Messages (DMs), Chatrooms, Me.
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  int _tab = 0;
  ChatChannelSubscription? _notifySub;
  String? _notifySubUserId;

  static const _titles = ['Feed', 'Explore', 'Messages', 'Chatrooms', 'Me'];

  @override
  void dispose() {
    _notifySub?.close();
    super.dispose();
  }

  /// Wire the chat-notify Ably channel for the current viewer once they
  /// land in the shell. Pings refresh the conversation list so the
  /// Messages-tab badge stays accurate.
  void _ensureNotifySubscription(String userId) {
    if (_notifySubUserId == userId && _notifySub != null) return;
    _notifySub?.close();
    _notifySubUserId = userId;
    _notifySub = ref.read(ablyServiceProvider).subscribeNotify(
          userId,
          onPing: () {
            if (!mounted) return;
            ref.read(conversationListProvider.notifier).refresh();
          },
        );
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final username = session?.user.username;
    final viewerTheme = ref.watch(viewerThemeProvider);
    final unreadDms = ref.watch(unreadDmCountProvider);

    final viewerId = session?.user.id;
    if (viewerId != null) {
      // initState can't see the session yet on first paint, so wire the
      // notify subscription here once the viewer is known.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _ensureNotifySubscription(viewerId);
      });
    }

    // The Me tab composes its own AppBar with the profile-specific chrome,
    // so we suppress the shell's AppBar on that tab. With the new Explore
    // tab the Me index shifts to 4.
    final showAppBar = _tab != 4;

    return ThemedBackground(
      theme: viewerTheme,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: showAppBar
            ? AppBar(
                backgroundColor: Colors.transparent,
                elevation: 0,
                title: Text(_titles[_tab]),
                actions: [
                  // NSFW toggle is visible on Feed and Chatrooms tabs —
                  // both surface NSFW-gated content (posts and rooms).
                  // Chatrooms is now index 3 after Explore slotted in.
                  if (_tab == 0 || _tab == 3) const NsfwToggle(),
                  if (_tab == 0)
                    PopupMenuButton<String>(
                      tooltip: 'More',
                      icon: const Icon(Icons.more_vert),
                      onSelected: (v) {
                        switch (v) {
                          case 'marketplace':
                            Navigator.of(context).push(MaterialPageRoute(
                              builder: (_) => const MarketplaceScreen(),
                            ));
                            break;
                          case 'lists':
                            Navigator.of(context).push(MaterialPageRoute(
                              builder: (_) => const CuratedListsScreen(),
                            ));
                            break;
                          case 'appearance':
                            Navigator.of(context).push(MaterialPageRoute(
                              builder: (_) => const ThemeEditScreen(),
                            ));
                            break;
                          case 'signout':
                            ref.read(sessionProvider.notifier).clear();
                            break;
                        }
                      },
                      itemBuilder: (_) => const [
                        PopupMenuItem(
                          value: 'marketplace',
                          child: ListTile(
                            leading: Icon(Icons.shopping_bag_outlined),
                            title: Text('Marketplace'),
                            contentPadding: EdgeInsets.zero,
                          ),
                        ),
                        PopupMenuItem(
                          value: 'lists',
                          child: ListTile(
                            leading: Icon(Icons.playlist_play),
                            title: Text('Lists'),
                            contentPadding: EdgeInsets.zero,
                          ),
                        ),
                        PopupMenuItem(
                          value: 'appearance',
                          child: ListTile(
                            leading: Icon(Icons.palette_outlined),
                            title: Text('Appearance'),
                            contentPadding: EdgeInsets.zero,
                          ),
                        ),
                        PopupMenuDivider(),
                        PopupMenuItem(
                          value: 'signout',
                          child: ListTile(
                            leading: Icon(Icons.logout),
                            title: Text('Sign out'),
                            contentPadding: EdgeInsets.zero,
                          ),
                        ),
                      ],
                    ),
                ],
              )
            : null,
        body: IndexedStack(
          index: _tab,
          children: [
            const FeedScreen(),
            const ExploreScreen(),
            const MessagesScreen(),
            const ChatroomsScreen(),
            if (username != null)
              ProfileScreen(username: username)
            else
              const Center(child: CircularProgressIndicator()),
          ],
        ),
        floatingActionButton: _tab == 0
            ? FloatingActionButton(
                tooltip: 'New post',
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    fullscreenDialog: true,
                    builder: (_) => const ComposeScreen(),
                  ),
                ),
                child: const Icon(Icons.edit),
              )
            : null,
        bottomNavigationBar: NavigationBar(
          backgroundColor: Colors.transparent,
          selectedIndex: _tab,
          onDestinationSelected: (i) => setState(() => _tab = i),
          destinations: [
            const NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home),
              label: 'Feed',
            ),
            const NavigationDestination(
              icon: Icon(Icons.tag_outlined),
              selectedIcon: Icon(Icons.tag),
              label: 'Explore',
            ),
            NavigationDestination(
              icon: _BadgedIcon(
                icon: Icons.chat_bubble_outline,
                count: unreadDms,
              ),
              selectedIcon: _BadgedIcon(
                icon: Icons.chat_bubble,
                count: unreadDms,
              ),
              label: 'Messages',
            ),
            const NavigationDestination(
              icon: Icon(Icons.forum_outlined),
              selectedIcon: Icon(Icons.forum),
              label: 'Rooms',
            ),
            const NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: 'Me',
            ),
          ],
        ),
      ),
    );
  }
}

/// Nav-bar icon with a small red unread-count badge in the top-right
/// corner. Hides itself when [count] is zero.
class _BadgedIcon extends StatelessWidget {
  const _BadgedIcon({required this.icon, required this.count});

  final IconData icon;
  final int count;

  @override
  Widget build(BuildContext context) {
    if (count <= 0) return Icon(icon);
    final label = count > 99 ? '99+' : '$count';
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Icon(icon),
        Positioned(
          right: -8,
          top: -4,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
            constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
            decoration: BoxDecoration(
              color: Colors.redAccent,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
