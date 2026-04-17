import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api/api_client.dart';
import 'api/theme_api.dart';
import 'models/resolved_theme.dart';

/// Global DI wiring. Providers that don't depend on runtime input belong
/// here so `ProviderScope` overrides in tests can swap them wholesale.
final dioProvider = Provider<Dio>((ref) => buildDio());

final themeApiProvider = Provider<ThemeApi>(
  (ref) => ThemeApi(ref.watch(dioProvider)),
);

/// Family-provider: fetches the resolved theme for the given username.
/// `ref.watch(userThemeProvider('alice'))` returns an `AsyncValue`.
final userThemeProvider =
    FutureProvider.autoDispose.family<ThemeResponse, String>((ref, username) {
  return ref.watch(themeApiProvider).fetch(username);
});
