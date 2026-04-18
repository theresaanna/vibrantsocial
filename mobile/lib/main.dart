import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'providers.dart';
import 'screens/auth_gate.dart';

void main() {
  runApp(const ProviderScope(child: VibrantSocialApp()));
}

class VibrantSocialApp extends ConsumerStatefulWidget {
  const VibrantSocialApp({super.key});

  @override
  ConsumerState<VibrantSocialApp> createState() => _VibrantSocialAppState();
}

class _VibrantSocialAppState extends ConsumerState<VibrantSocialApp> {
  @override
  void initState() {
    super.initState();
    // Validate any persisted JWT on boot so the AuthGate sees the right
    // session state before rendering.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(sessionProvider.notifier).bootstrap();
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VibrantSocial',
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFD946EF)),
      ),
      home: const AuthGate(),
    );
  }
}
