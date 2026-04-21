import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/post_api.dart';
import '../providers.dart';
import '../widgets/themed_background.dart';
import '../widgets/themed_container.dart';

/// "My scheduled posts" — shows queued posts that haven't published
/// yet and lets the viewer cancel them. Reachable from the composer's
/// "Manage queue" link.
class ScheduledPostsScreen extends ConsumerStatefulWidget {
  const ScheduledPostsScreen({super.key});

  @override
  ConsumerState<ScheduledPostsScreen> createState() =>
      _ScheduledPostsScreenState();
}

class _ScheduledPostsScreenState
    extends ConsumerState<ScheduledPostsScreen> {
  late Future<List<ScheduledPostSummary>> _load;

  @override
  void initState() {
    super.initState();
    _load = ref.read(postApiProvider).fetchScheduledPosts();
  }

  Future<void> _refresh() async {
    setState(() {
      _load = ref.read(postApiProvider).fetchScheduledPosts();
    });
    await _load;
  }

  Future<void> _cancel(ScheduledPostSummary post) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel scheduled post?'),
        content: Text(
          'It won\'t publish at ${_fmt(post.scheduledFor.toLocal())}. '
          'This can\'t be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Keep'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
            ),
            child: const Text('Cancel post'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(postApiProvider).cancelScheduledPost(post.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Scheduled post canceled.')),
      );
      await _refresh();
    } on DioException catch (e) {
      if (!mounted) return;
      final msg = e.response?.data is Map
          ? ((e.response!.data as Map)['error']?.toString() ??
              'Could not cancel.')
          : 'Could not cancel.';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewerTheme = ref.watch(viewerThemeProvider);
    final textColor = viewerTheme?.colors.textColor;
    return ThemedBackground(
      theme: viewerTheme,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text('Scheduled posts'),
          backgroundColor: Colors.transparent,
          foregroundColor: textColor,
        ),
        body: RefreshIndicator(
          onRefresh: _refresh,
          child: FutureBuilder<List<ScheduledPostSummary>>(
            future: _load,
            builder: (context, snap) {
              if (snap.connectionState != ConnectionState.done) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snap.hasError) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      'Couldn\'t load your queue.\n${snap.error}',
                      textAlign: TextAlign.center,
                    ),
                  ),
                );
              }
              final posts = snap.data ?? const [];
              if (posts.isEmpty) {
                return ListView(
                  children: const [
                    SizedBox(height: 140),
                    Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text(
                          'Nothing queued.\nSchedule a post from the composer.',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                  ],
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
                itemCount: posts.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  final post = posts[i];
                  return ThemedContainer(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.schedule, size: 16),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                _fmt(post.scheduledFor.toLocal()),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            TextButton(
                              onPressed: () => _cancel(post),
                              style: TextButton.styleFrom(
                                foregroundColor:
                                    Theme.of(context).colorScheme.error,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                ),
                                minimumSize: Size.zero,
                                tapTargetSize:
                                    MaterialTapTargetSize.shrinkWrap,
                              ),
                              child: const Text('Cancel'),
                            ),
                          ],
                        ),
                        if (post.text.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            post.text.length > 280
                                ? '${post.text.substring(0, 280)}…'
                                : post.text,
                          ),
                        ],
                        if (post.tagNames.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 4,
                            runSpacing: 4,
                            children: [
                              for (final tag in post.tagNames)
                                Text(
                                  '#$tag',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Theme.of(context)
                                        .colorScheme
                                        .primary,
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  );
                },
              );
            },
          ),
        ),
      ),
    );
  }
}

/// "Mon Apr 21, 3:05 PM" shorthand — duplicated from compose_screen so
/// this file doesn't pull in the composer's state machinery.
String _fmt(DateTime dt) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  final hour24 = dt.hour;
  final hour = hour24 == 0 ? 12 : (hour24 > 12 ? hour24 - 12 : hour24);
  final suffix = hour24 < 12 ? 'AM' : 'PM';
  final minute = dt.minute.toString().padLeft(2, '0');
  return '${months[dt.month - 1]} ${dt.day}, $hour:$minute $suffix';
}
