import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../providers.dart';

/// Header icon button that — on mobile — opens a modal pointing users
/// to the website for additional content preferences.
///
/// The Play-Store build of VibrantSocial hides NSFW / sensitive /
/// graphic content unconditionally (Google policy). The full set of
/// preferences lives on the web; this button is intentionally still
/// present so the entry point is discoverable.
class NsfwToggle extends ConsumerWidget {
  const NsfwToggle({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final defaultColor =
        ref.watch(viewerThemeProvider)?.colors.textColor ??
            Theme.of(context).colorScheme.onSurface;
    return IconButton(
      tooltip: 'Content preferences',
      icon: Icon(Icons.tune, color: defaultColor),
      onPressed: () => _showContentPrefsSheet(context),
    );
  }
}

/// Bottom sheet explaining that full content controls live on the web.
/// Wording is intentionally neutral ("additional content preferences")
/// — Play reviewers read modal copy verbatim and reject anything that
/// reads like a promise of explicit content.
void _showContentPrefsSheet(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (ctx) => Padding(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Content preferences',
            style: Theme.of(ctx)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          const Text(
            'Additional content preferences and settings are available '
            'on the VibrantSocial website. Sign in with the same account '
            'to manage them.',
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('Not now'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () async {
                    final uri = Uri.parse('https://vibrantsocial.app');
                    await launchUrl(uri,
                        mode: LaunchMode.externalApplication);
                    if (ctx.mounted) Navigator.of(ctx).pop();
                  },
                  icon: const Icon(Icons.open_in_new, size: 16),
                  label: const Text('Open website'),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}
