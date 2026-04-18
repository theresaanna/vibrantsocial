import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

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
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFD946EF)),
    );
    // App-wide font: Lexend, weight 300. Per-user custom fonts (premium
    // display fonts) apply only to username rendering — see
    // `UsernameText`.
    final lexend = GoogleFonts.lexendTextTheme(base.textTheme);
    final appTheme = base.copyWith(
      textTheme: _withWeight(lexend, FontWeight.w300),
    );
    return MaterialApp(
      title: 'VibrantSocial',
      theme: appTheme,
      home: const AuthGate(),
    );
  }
}

/// Walk every slot in a [TextTheme] and replace the weight with [weight].
/// Done after GoogleFonts so the Lexend family comes through but each
/// baseline style renders at our chosen weight.
TextTheme _withWeight(TextTheme theme, FontWeight weight) {
  TextStyle? w(TextStyle? s) => s?.copyWith(fontWeight: weight);
  return theme.copyWith(
    displayLarge: w(theme.displayLarge),
    displayMedium: w(theme.displayMedium),
    displaySmall: w(theme.displaySmall),
    headlineLarge: w(theme.headlineLarge),
    headlineMedium: w(theme.headlineMedium),
    headlineSmall: w(theme.headlineSmall),
    titleLarge: w(theme.titleLarge),
    titleMedium: w(theme.titleMedium),
    titleSmall: w(theme.titleSmall),
    bodyLarge: w(theme.bodyLarge),
    bodyMedium: w(theme.bodyMedium),
    bodySmall: w(theme.bodySmall),
    labelLarge: w(theme.labelLarge),
    labelMedium: w(theme.labelMedium),
    labelSmall: w(theme.labelSmall),
  );
}
