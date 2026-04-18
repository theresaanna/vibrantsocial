import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import '../widgets/themed_background.dart';
import 'compose_screen.dart';
import 'feed_screen.dart';
import 'profile_screen.dart';

/// Two-tab shell for the authenticated experience: Feed (home timeline)
/// and Me (the signed-in user's profile). Additional tabs (search,
/// notifications, chat) land in later slices.
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final username = session?.user.username;
    // Paint the viewer's ambient theme behind the whole shell. The Me
    // tab's ProfileScreen already has its own ThemedBackground (using the
    // viewed profile's theme), which for the signed-in user coincides —
    // DecoratedBox composes correctly either way.
    final viewerTheme = ref.watch(viewerThemeProvider);
    return ThemedBackground(
      theme: viewerTheme,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: _tab == 0
            ? AppBar(
                backgroundColor: Colors.transparent,
                elevation: 0,
                title: const Text('Feed'),
                actions: [
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
            if (username != null)
              ProfileScreen(username: username)
            else
              const Center(child: CircularProgressIndicator()),
          ],
        ),
        floatingActionButton: FloatingActionButton(
          tooltip: 'New post',
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(
              fullscreenDialog: true,
              builder: (_) => const ComposeScreen(),
            ),
          ),
          child: const Icon(Icons.edit),
        ),
        bottomNavigationBar: NavigationBar(
          backgroundColor: Colors.transparent,
          selectedIndex: _tab,
          onDestinationSelected: (i) => setState(() => _tab = i),
          destinations: const [
            NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home),
                label: 'Feed'),
            NavigationDestination(
                icon: Icon(Icons.person_outline),
                selectedIcon: Icon(Icons.person),
                label: 'Me'),
          ],
        ),
      ),
    );
  }
}
