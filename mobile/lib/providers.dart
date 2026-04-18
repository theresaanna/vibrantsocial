import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api/api_client.dart';
import 'api/auth_api.dart';
import 'api/interaction_api.dart';
import 'api/media_api.dart';
import 'api/post_api.dart';
import 'api/profile_api.dart';
import 'api/theme_api.dart';
import 'controllers/post_list_controller.dart';
import 'controllers/profile_list_controller.dart';
import 'models/comment.dart';
import 'models/post.dart';
import 'models/profile.dart';
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

final profileApiProvider = Provider<ProfileApi>(
  (ref) => ProfileApi(ref.watch(dioProvider)),
);

/// Family: fetches the full profile paint for a username.
final profileProvider =
    FutureProvider.autoDispose.family<ProfileResponse, String>((ref, username) {
  return ref.watch(profileApiProvider).fetch(username);
});

/// The signed-in viewer's own resolved theme — used to paint the ambient
/// background on screens that aren't already showing someone else's
/// profile. Returns null while the session is still bootstrapping or if
/// the viewer doesn't have a username yet.
final viewerThemeProvider = Provider<ResolvedTheme?>((ref) {
  final session = ref.watch(sessionProvider);
  final username = session?.user.username;
  if (username == null) return null;
  final profile = ref.watch(profileProvider(username));
  return profile.maybeWhen(data: (p) => p.theme, orElse: () => null);
});

/// Paginated followers / following / friends list for a profile. One
/// controller per (username, kind) pair — Riverpod's family key dedupes.
final profileListProvider = StateNotifierProvider.autoDispose
    .family<ProfileListController, ProfileListState, ProfileListKey>(
  (ref, key) => ProfileListController(ref.watch(profileApiProvider), key),
);

final postApiProvider = Provider<PostApi>(
  (ref) => PostApi(ref.watch(dioProvider)),
);

final interactionApiProvider = Provider<InteractionApi>(
  (ref) => InteractionApi(ref.watch(dioProvider)),
);

final mediaApiProvider = Provider<MediaApi>(
  (ref) => MediaApi(ref.watch(dioProvider)),
);

/// Home feed controller. One instance per session — kept alive so
/// scroll position and loaded pages survive navigation.
final feedProvider =
    StateNotifierProvider<PostListController, PostListState>((ref) {
  final api = ref.watch(postApiProvider);
  return PostListController((cursor) => api.fetchFeed(cursor: cursor));
});

/// Paginated posts for a specific user's profile tab.
final profilePostsProvider = StateNotifierProvider.autoDispose
    .family<PostListController, PostListState, String>((ref, username) {
  final api = ref.watch(postApiProvider);
  return PostListController(
    (cursor) => api.fetchProfilePosts(username: username, cursor: cursor),
  );
});

/// Single post fetch. Usually navigated into from the feed or profile,
/// but also the entry point for deep links.
final postProvider =
    FutureProvider.autoDispose.family<Post, String>((ref, id) {
  return ref.watch(postApiProvider).fetchPost(id);
});

/// Top-level comments for a post. autoDispose so memory doesn't leak
/// when the user backs out of a detail screen.
final commentsProvider =
    FutureProvider.autoDispose.family<CommentPage, String>((ref, postId) {
  return ref.watch(postApiProvider).fetchComments(postId: postId);
});

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
