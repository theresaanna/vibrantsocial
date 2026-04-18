import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import 'login_screen.dart';
import 'theme_preview_screen.dart';

/// Routes between login and the post-login landing based on the current
/// [sessionProvider]. Until profiles land, the post-login surface is the
/// [ThemePreviewScreen] we built for the theme slice.
class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    if (session == null) return const LoginScreen();
    return const ThemePreviewScreen();
  }
}
