import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'screens/theme_preview_screen.dart';

void main() {
  runApp(const ProviderScope(child: VibrantSocialApp()));
}

class VibrantSocialApp extends StatelessWidget {
  const VibrantSocialApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VibrantSocial',
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFD946EF)),
      ),
      home: const ThemePreviewScreen(),
    );
  }
}
