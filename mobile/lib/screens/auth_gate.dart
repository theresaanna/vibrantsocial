import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import 'home_shell.dart';
import 'login_screen.dart';

/// Routes between login and the post-login landing based on the current
/// [sessionProvider]. Landing is the user's own profile for now; a
/// bottom-nav with feed + notifications + chat + profile tabs lands in
/// a later slice.
class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    if (session == null) return const LoginScreen();
    final username = session.user.username;
    if (username == null) {
      // Signed in but no handle yet (OAuth account before completion).
      // Send them to a completion screen later; for now show a stub.
      return const _AwaitingUsernameScreen();
    }
    return const HomeShell();
  }
}

class _AwaitingUsernameScreen extends ConsumerWidget {
  const _AwaitingUsernameScreen();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pick a username'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(sessionProvider.notifier).clear(),
          ),
        ],
      ),
      body: const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'You need to finish setting up your profile before continuing. '
            'The username picker lands in a later slice — until then, visit '
            'vibrantsocial.app in a browser to complete signup.',
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}
