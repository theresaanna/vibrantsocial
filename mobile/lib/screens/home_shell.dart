import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import '../widgets/themed_background.dart';
import 'chatrooms_screen.dart';
import 'compose_screen.dart';
import 'feed_screen.dart';
import 'messages_screen.dart';
import 'profile_screen.dart';

/// Four-tab authenticated shell: Feed, Messages (DMs), Chatrooms, Me.
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  int _tab = 0;

  static const _titles = ['Feed', 'Messages', 'Chatrooms', 'Me'];

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final username = session?.user.username;
    final viewerTheme = ref.watch(viewerThemeProvider);

    // The Me tab composes its own AppBar with the profile-specific chrome,
    // so we suppress the shell's AppBar on that tab.
    final showAppBar = _tab != 3;

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
                  if (_tab == 0)
                    IconButton(
                      tooltip: 'Sign out',
                      icon: const Icon(Icons.logout),
                      onPressed: () =>
                          ref.read(sessionProvider.notifier).clear(),
                    ),
                ],
              )
            : null,
        body: IndexedStack(
          index: _tab,
          children: [
            const FeedScreen(),
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
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home),
              label: 'Feed',
            ),
            NavigationDestination(
              icon: Icon(Icons.chat_bubble_outline),
              selectedIcon: Icon(Icons.chat_bubble),
              label: 'Messages',
            ),
            NavigationDestination(
              icon: Icon(Icons.forum_outlined),
              selectedIcon: Icon(Icons.forum),
              label: 'Rooms',
            ),
            NavigationDestination(
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
