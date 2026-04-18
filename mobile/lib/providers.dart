import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api/api_client.dart';
import 'api/auth_api.dart';
import 'api/theme_api.dart';
import 'models/resolved_theme.dart';
import 'models/session.dart';
import 'services/native_oauth.dart';
import 'services/token_store.dart';

/// Global DI wiring. Providers that don't depend on runtime input live
/// here so `ProviderScope` overrides in tests can swap them wholesale.

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

final dioProvider = Provider<Dio>((ref) {
  return buildDio(
    tokenStore: ref.watch(tokenStoreProvider),
    onUnauthorized: () async {
      // A 401 means the stored token is no longer valid — flip the session
      // back to null so the AuthGate sends the user to login.
      ref.read(sessionProvider.notifier).clear();
    },
  );
});

final authApiProvider = Provider<AuthApi>(
  (ref) => AuthApi(ref.watch(dioProvider)),
);

final nativeOAuthProvider = Provider<NativeOAuth>((ref) => NativeOAuth());

final themeApiProvider = Provider<ThemeApi>(
  (ref) => ThemeApi(ref.watch(dioProvider)),
);

/// Current authenticated session, or null. Starts as null and is populated
/// on app boot via [bootstrapSession] (called from main).
class SessionController extends StateNotifier<Session?> {
  SessionController(this._ref) : super(null);

  final Ref _ref;

  Future<void> bootstrap() async {
    final token = await _ref.read(tokenStoreProvider).read();
    if (token == null || token.isEmpty) return;
    try {
      final user = await _ref.read(authApiProvider).me();
      state = Session(token: token, user: user);
    } on DioException {
      // Interceptor already cleared the token on 401; nothing else to do.
      state = null;
    }
  }

  Future<void> set(Session session) async {
    await _ref.read(tokenStoreProvider).write(session.token);
    state = session;
  }

  Future<void> clear() async {
    await _ref.read(tokenStoreProvider).clear();
    state = null;
  }
}

final sessionProvider =
    StateNotifierProvider<SessionController, Session?>((ref) {
  return SessionController(ref);
});

/// Family: fetches the resolved theme for the given username.
final userThemeProvider =
    FutureProvider.autoDispose.family<ThemeResponse, String>((ref, username) {
  return ref.watch(themeApiProvider).fetch(username);
});
