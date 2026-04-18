import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api/api_client.dart';
import 'api/auth_api.dart';
import 'api/avatar_frames_api.dart';
import 'api/chatroom_api.dart';
import 'api/interaction_api.dart';
import 'api/link_preview_api.dart';
import 'api/media_api.dart';
import 'api/media_feed_api.dart';
import 'api/messaging_api.dart';
import 'api/post_api.dart';
import 'api/prefs_api.dart';
import 'api/profile_api.dart';
import 'api/rpc_client.dart';
import 'api/theme_api.dart';
import 'controllers/chat_message_controller.dart';
import 'controllers/chatroom_list_controller.dart';
import 'controllers/conversation_list_controller.dart';
import 'controllers/media_list_controller.dart';
import 'controllers/message_requests_controller.dart';
import 'controllers/nsfw_pref_controller.dart';
import 'controllers/post_list_controller.dart';
import 'controllers/profile_list_controller.dart';
import 'models/avatar_frame.dart';
import 'models/comment.dart';
import 'models/link_preview.dart';
import 'models/post.dart';
import 'models/profile.dart';
import 'models/resolved_theme.dart';
import 'models/session.dart';
import 'services/ably_service.dart';
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

/// Home feed controller. Watches the NSFW pref so flipping the toggle
/// in the header reissues the feed query (server-side filter).
final feedProvider =
    StateNotifierProvider<PostListController, PostListState>((ref) {
  final api = ref.watch(postApiProvider);
  // Establish a dependency without using the value directly — the
  // server reads the pref from the user record on each request.
  ref.watch(nsfwPrefProvider);
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

// ── Chat (DMs + chatrooms) ──────────────────────────────────────────

final rpcClientProvider = Provider<RpcClient>(
  (ref) => RpcClient(ref.watch(dioProvider)),
);

final messagingApiProvider = Provider<MessagingApi>(
  (ref) => MessagingApi(ref.watch(rpcClientProvider)),
);

final chatroomApiProvider = Provider<ChatroomApi>(
  (ref) => ChatroomApi(ref.watch(rpcClientProvider)),
);

final linkPreviewApiProvider = Provider<LinkPreviewApi>(
  (ref) => LinkPreviewApi(ref.watch(rpcClientProvider)),
);

final prefsApiProvider = Provider<PrefsApi>(
  (ref) => PrefsApi(ref.watch(rpcClientProvider)),
);

final avatarFramesApiProvider = Provider<AvatarFramesApi>(
  (ref) => AvatarFramesApi(ref.watch(rpcClientProvider)),
);

/// Catalog of all avatar frames keyed by id. Fetched once per session;
/// chat bubbles and other surfaces look up the sender's frame here
/// instead of carrying the geometry in every message payload.
final avatarFramesProvider = FutureProvider<Map<String, AvatarFrame>>((ref) {
  return ref.watch(avatarFramesApiProvider).fetchAll();
});

final mediaFeedApiProvider = Provider<MediaFeedApi>(
  (ref) => MediaFeedApi(ref.watch(rpcClientProvider)),
);

/// Media-only home feed (posts containing images/videos/YouTube).
/// Watches NSFW pref so flipping the toggle reissues with new filter.
final mediaFeedProvider =
    StateNotifierProvider<MediaListController, MediaListState>((ref) {
  final api = ref.watch(mediaFeedApiProvider);
  ref.watch(nsfwPrefProvider);
  return MediaListController((cursor) => api.fetchFeed(cursor: cursor));
});

/// Media grid for a specific user's profile. Family-keyed by username.
final profileMediaProvider = StateNotifierProvider.autoDispose
    .family<MediaListController, MediaListState, String>((ref, username) {
  final api = ref.watch(mediaFeedApiProvider);
  ref.watch(nsfwPrefProvider);
  return MediaListController(
    (cursor) => api.fetchProfile(username, cursor: cursor),
  );
});

/// Viewer's NSFW visibility preference. Bootstraps from the server on
/// first read; flipping it triggers refresh of feed + chatroom lists so
/// they reflect the new filter.
final nsfwPrefProvider =
    StateNotifierProvider<NsfwPrefController, bool>((ref) {
  return NsfwPrefController(ref.watch(prefsApiProvider));
});

/// Server fetches OG metadata; cached in Redis for 7 days. Family keyed
/// by URL — autoDispose so we drop the result when no message bubble is
/// rendering it anymore. Cache hits stay essentially free.
final linkPreviewProvider = FutureProvider.autoDispose
    .family<LinkPreviewData?, String>((ref, url) {
  return ref.watch(linkPreviewApiProvider).fetch(url);
});

final ablyServiceProvider = Provider<AblyService>((ref) {
  final service = AblyService(ref.watch(dioProvider));
  ref.onDispose(() async {
    await service.dispose();
  });
  return service;
});

/// DM conversation list. One instance per session (not autoDispose) so
/// the list survives tab switches on the home shell.
final conversationListProvider = StateNotifierProvider<
    ConversationListController, ConversationListState>((ref) {
  return ConversationListController(ref.watch(messagingApiProvider));
});

/// Pending incoming message requests inbox.
final messageRequestsProvider = StateNotifierProvider<
    MessageRequestsController, MessageRequestsState>((ref) {
  return MessageRequestsController(ref.watch(messagingApiProvider));
});

/// Total unread DM count across all conversations. Watched by the
/// Messages tab to render a badge.
final unreadDmCountProvider = Provider<int>((ref) {
  final convs = ref.watch(conversationListProvider).conversations;
  var total = 0;
  for (final c in convs) {
    total += c.unreadCount;
  }
  return total;
});

/// Browsable public chatrooms. Rebuilds when the NSFW pref flips so the
/// query reissues with the right `showNsfw` flag.
final chatroomListProvider = StateNotifierProvider<
    ChatroomListController, ChatroomListState>((ref) {
  final showNsfw = ref.watch(nsfwPrefProvider);
  return ChatroomListController(
    ref.watch(chatroomApiProvider),
    showNsfw: showNsfw,
  );
});

/// Paginated messages for a DM conversation. Keyed by conversationId so
/// switching between threads yields separate state.
final conversationMessagesProvider = StateNotifierProvider.autoDispose
    .family<ChatMessageListController, ChatMessageListState, String>(
  (ref, conversationId) {
    final api = ref.watch(messagingApiProvider);
    return ChatMessageListController(
      (cursor) => api.getMessages(conversationId, cursor: cursor),
    );
  },
);

/// Paginated messages for a chatroom. Keyed by slug.
final chatroomMessagesProvider = StateNotifierProvider.autoDispose
    .family<ChatMessageListController, ChatMessageListState, String>(
  (ref, slug) {
    final api = ref.watch(chatroomApiProvider);
    return ChatMessageListController(
      (cursor) => api.getMessages(slug: slug, cursor: cursor),
    );
  },
);
