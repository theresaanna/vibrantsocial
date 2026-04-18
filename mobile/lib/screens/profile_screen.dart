import 'package:dio/dio.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/profile_api.dart';
import '../controllers/post_list_controller.dart';
import '../models/avatar_frame.dart';
import '../models/profile.dart';
import '../models/resolved_theme.dart';
import '../providers.dart';
import '../widgets/block_renderer.dart';
import '../widgets/framed_avatar.dart';
import '../widgets/post_card.dart';
import '../widgets/themed_background.dart';
import '../widgets/username_text.dart';
import 'user_list_screen.dart';
import 'user_posts_screen.dart';

/// Public profile view. Mirrors the web profile layout (themed background,
/// container panel with the user's colors, avatar + frame overlay, bio,
/// counts, primary relationship action, links). Slice-local and doesn't
/// yet include posts/statuses tabs or the edit-profile surface.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key, required this.username});

  final String username;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(profileProvider(username));
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(sessionProvider.notifier).clear(),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(_profileErrorMessage(err), textAlign: TextAlign.center),
          ),
        ),
        data: (profile) => _ProfileBody(profile: profile),
      ),
    );
  }
}

class _ProfileBody extends ConsumerStatefulWidget {
  const _ProfileBody({required this.profile});

  final ProfileResponse profile;

  @override
  ConsumerState<_ProfileBody> createState() => _ProfileBodyState();
}

class _ProfileBodyState extends ConsumerState<_ProfileBody> {
  late final ScrollController _scrollCtrl;

  @override
  void initState() {
    super.initState();
    _scrollCtrl = ScrollController()..addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollCtrl.removeListener(_onScroll);
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollCtrl.hasClients) return;
    final pos = _scrollCtrl.position;
    if (pos.pixels > pos.maxScrollExtent - 600) {
      ref
          .read(profilePostsProvider(widget.profile.user.username ?? '').notifier)
          .loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = widget.profile;
    final theme = profile.theme;
    final colors = theme.colors;
    final username = profile.user.username ?? '';
    final postsState = username.isEmpty
        ? null
        : ref.watch(profilePostsProvider(username));

    final containerColor = _withAlphaPercent(
      colors.containerColor,
      theme.container.opacity,
    );

    return ThemedBackground(
      theme: theme,
      child: ListView(
        controller: _scrollCtrl,
        padding: EdgeInsets.zero,
        children: [
          const SizedBox(height: 56),
          FramedAvatar(
            avatarUrl: profile.user.avatar,
            frame: theme.frame == null
                ? null
                : avatarFrameFromTheme(theme.frame),
            size: 120,
            borderColor: colors.containerColor,
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Material(
              color: containerColor,
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _NameHeader(profile: profile, colors: colors),
                    const SizedBox(height: 12),
                    _CountsRow(
                      username: profile.user.username ?? '',
                      counts: profile.counts,
                      colors: colors,
                    ),
                    const SizedBox(height: 16),
                    _RelationshipActions(
                      username: username,
                      relationship: profile.relationship,
                      colors: colors,
                    ),
                    if (profile.user.bioBlocks.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      _SectionLabel(label: 'About', colors: colors),
                      const SizedBox(height: 6),
                      DefaultTextStyle.merge(
                        style: TextStyle(color: colors.textColor),
                        child: BlockRenderer(blocks: profile.user.bioBlocks),
                      ),
                    ] else if (profile.user.bioSegments.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      _SectionLabel(label: 'About', colors: colors),
                      const SizedBox(height: 6),
                      _BioRichText(
                        segments: profile.user.bioSegments,
                        colors: colors,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (postsState != null) ..._postTail(postsState),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  /// Build the profile's posts tail: section header, rendered post cards,
  /// and an optional loading indicator pinned at the end when more pages
  /// remain. Scroll-near-bottom triggers [_onScroll] to page in the next.
  Iterable<Widget> _postTail(PostListState state) sync* {
    if (state.posts.isEmpty && state.isLoadingMore) {
      yield const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator()),
      );
      return;
    }
    if (state.posts.isEmpty) {
      yield const Padding(
        padding: EdgeInsets.fromLTRB(16, 8, 16, 8),
        child: Center(child: Text('No posts yet.')),
      );
      return;
    }
    yield const SizedBox(height: 8);
    final username = widget.profile.user.username ?? '';
    for (final post in state.posts) {
      yield PostCard(
        post: post,
        onMutate: (updated) => ref
            .read(profilePostsProvider(username).notifier)
            .updatePost(post.id, (_) => updated),
      );
      yield const SizedBox(height: 4);
    }
    if (state.isLoadingMore) {
      yield const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(child: CircularProgressIndicator()),
      );
    }
  }
}

class _NameHeader extends StatelessWidget {
  const _NameHeader({required this.profile, required this.colors});

  final ProfileResponse profile;
  final ResolvedColors colors;

  @override
  Widget build(BuildContext context) {
    final user = profile.user;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: UsernameText(
                text: user.displayNameOrUsername,
                fontFamily: profile.theme.font?.googleFamily.replaceAll('+', ' '),
                style: TextStyle(
                  color: colors.textColor,
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            if (user.tier == 'premium')
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: colors.linkColor,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Text(
                  'premium',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
          ],
        ),
        if (user.username != null)
          Text(
            '@${user.username}',
            style: TextStyle(color: colors.secondaryColor, fontSize: 14),
          ),
      ],
    );
  }
}

class _CountsRow extends StatelessWidget {
  const _CountsRow({
    required this.username,
    required this.counts,
    required this.colors,
  });

  final String username;
  final ProfileCounts counts;
  final ResolvedColors colors;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _CountCell(
          label: 'followers',
          value: counts.followers,
          colors: colors,
          onTap: () => _openList(context, ProfileListKind.followers),
        ),
        _CountCell(
          label: 'following',
          value: counts.following,
          colors: colors,
          onTap: () => _openList(context, ProfileListKind.following),
        ),
        _CountCell(
          label: 'friends',
          value: counts.friends,
          colors: colors,
          onTap: () => _openList(context, ProfileListKind.friends),
        ),
        _CountCell(
          label: 'posts',
          value: counts.posts,
          colors: colors,
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => UserPostsScreen(username: username),
            ),
          ),
        ),
      ],
    );
  }

  void _openList(BuildContext context, ProfileListKind kind) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => UserListScreen(username: username, kind: kind),
      ),
    );
  }
}

class _CountCell extends StatelessWidget {
  const _CountCell({
    required this.label,
    required this.value,
    required this.colors,
    this.onTap,
  });

  final String label;
  final int value;
  final ResolvedColors colors;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            children: [
              Text(
                _format(value),
                style: TextStyle(
                  color: colors.textColor,
                  fontWeight: FontWeight.w700,
                  fontSize: 18,
                ),
              ),
              Text(
                label,
                style: TextStyle(color: colors.secondaryColor, fontSize: 11),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _format(int n) {
    if (n < 1000) return '$n';
    if (n < 1000000) return '${(n / 1000).toStringAsFixed(n < 10000 ? 1 : 0)}k';
    return '${(n / 1000000).toStringAsFixed(1)}m';
  }
}

class _RelationshipActions extends ConsumerStatefulWidget {
  const _RelationshipActions({
    required this.username,
    required this.relationship,
    required this.colors,
  });

  final String username;
  final ProfileRelationship relationship;
  final ResolvedColors colors;

  @override
  ConsumerState<_RelationshipActions> createState() =>
      _RelationshipActionsState();
}

class _RelationshipActionsState extends ConsumerState<_RelationshipActions> {
  bool _busy = false;

  ResolvedColors get colors => widget.colors;
  ProfileRelationship get relationship => widget.relationship;

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
      // Server is the source of truth — refetch the profile so counts +
      // flags reconcile. Non-optimistic but keeps the code small.
      ref.invalidate(profileProvider(widget.username));
    } on DioException catch (e) {
      if (!mounted) return;
      final msg = e.response?.data is Map
          ? ((e.response!.data as Map)['error']?.toString() ??
              'Something went wrong.')
          : 'Something went wrong.';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _toggleFollow() {
    final api = ref.read(interactionApiProvider);
    return _run(() async {
      if (relationship.isFollowing) {
        await api.unfollow(widget.username);
      } else {
        await api.follow(widget.username);
      }
    });
  }

  Future<void> _friendAction() {
    final api = ref.read(interactionApiProvider);
    return _run(() async {
      // Symmetric: send, accept-if-incoming, or remove/cancel all map
      // to one of two server endpoints.
      if (relationship.isFriend ||
          relationship.friendRequestOutgoing) {
        await api.friendRemove(widget.username);
      } else {
        await api.friendSendOrAccept(widget.username);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final r = relationship;
    final buttons = <Widget>[];

    if (r.isSelf) {
      buttons.add(_primary(context, 'Edit profile', onTap: null));
    } else if (r.blockedByMe) {
      buttons.add(_secondary(context, 'Blocked', onTap: null));
    } else {
      buttons.add(
        r.isFollowing
            ? _secondary(context, 'Following', onTap: _toggleFollow)
            : _primary(context, 'Follow', onTap: _toggleFollow),
      );
      if (r.isFriend) {
        buttons.add(_secondary(context, 'Friends', onTap: _friendAction));
      } else if (r.friendRequestOutgoing) {
        buttons.add(_secondary(context, 'Request pending', onTap: _friendAction));
      } else if (r.friendRequestIncoming) {
        buttons.add(_primary(context, 'Accept friend', onTap: _friendAction));
      } else {
        buttons.add(_secondary(context, 'Add friend', onTap: _friendAction));
      }
      if (r.canMessage) {
        // Messaging lands with the chat slice — leave inert for now.
        buttons.add(_secondary(context, 'Message', onTap: null));
      }
    }

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: buttons,
    );
  }

  Widget _primary(BuildContext context, String label, {VoidCallback? onTap}) {
    final fg = _readableOn(colors.linkColor);
    return FilledButton(
      // Mount-only until mutations ship — but we still want the button
      // styled as enabled. A no-op pressed handler keeps it tappable so
      // Flutter doesn't apply the washed-out disabled look.
      onPressed: onTap ?? () {},
      style: FilledButton.styleFrom(
        backgroundColor: colors.linkColor,
        // Pick black/white foreground based on the link color's luminance
        // so labels remain readable no matter which theme is in play.
        foregroundColor: fg,
        disabledBackgroundColor: colors.linkColor,
        disabledForegroundColor: fg,
      ),
      child: Text(label),
    );
  }

  Widget _secondary(BuildContext context, String label, {VoidCallback? onTap}) {
    return OutlinedButton(
      onPressed: onTap ?? () {},
      style: OutlinedButton.styleFrom(
        foregroundColor: colors.textColor,
        disabledForegroundColor: colors.textColor,
        side: BorderSide(color: colors.secondaryColor),
      ),
      child: Text(label),
    );
  }
}

/// Returns white or black, whichever contrasts better against [bg]. Used
/// when our computed backgrounds come from user theme colors that could
/// land on either side of the luminance threshold.
Color _readableOn(Color bg) {
  return bg.computeLuminance() > 0.5 ? Colors.black : Colors.white;
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label, required this.colors});

  final String label;
  final ResolvedColors colors;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: TextStyle(
        color: colors.secondaryColor,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.1,
        fontSize: 12,
      ),
    );
  }
}

/// Renders the server-emitted list of `BioSegment`s as a paragraph where
/// segments with a `url` are tappable. The server already marks link
/// ranges explicitly (walking the Lexical tree), so this doesn't need to
/// re-detect URLs.
class _BioRichText extends StatelessWidget {
  const _BioRichText({required this.segments, required this.colors});

  final List<BioSegment> segments;
  final ResolvedColors colors;

  @override
  Widget build(BuildContext context) {
    return Text.rich(
      TextSpan(
        children: [
          for (final seg in segments)
            if (seg.url != null)
              TextSpan(
                text: seg.text,
                style: TextStyle(
                  color: colors.linkColor,
                  decoration: TextDecoration.underline,
                  decorationColor: colors.linkColor,
                ),
                recognizer: TapGestureRecognizer()
                  ..onTap = () => _openUrl(seg.url!),
              )
            else
              TextSpan(text: seg.text),
        ],
      ),
      style: TextStyle(color: colors.textColor, fontSize: 15, height: 1.4),
    );
  }
}

Future<void> _openUrl(String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null) return;
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

/// Map a profile-fetch exception into a short, human-friendly message.
/// 404 lands here for deleted / suspended / blocked-by-viewer targets —
/// we don't leak the reason either way.
String _profileErrorMessage(Object err) {
  if (err is DioException) {
    final status = err.response?.statusCode;
    if (status == 404) return 'This profile is unavailable.';
    if (status == 401) return 'Please sign in to view this profile.';
    if (status == 403) return 'You do not have access to this profile.';
  }
  return 'Could not load profile. Pull to retry.';
}

Color _withAlphaPercent(Color base, int percent) {
  final pct = percent.clamp(0, 100) / 100.0;
  return base.withValues(alpha: pct);
}

