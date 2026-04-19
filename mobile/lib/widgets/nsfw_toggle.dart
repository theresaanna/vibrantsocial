import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';

/// Header icon button that flips the viewer's NSFW visibility pref.
/// Mirrors `src/components/nsfw-toggle.tsx`: circle-with-slash icon,
/// red when NSFW is enabled, default-text-color when disabled.
class NsfwToggle extends ConsumerWidget {
  const NsfwToggle({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final enabled = ref.watch(nsfwPrefProvider);
    final defaultColor =
        ref.watch(viewerThemeProvider)?.colors.textColor ??
            Theme.of(context).colorScheme.onSurface;
    final color = enabled ? Colors.redAccent : defaultColor;
    return IconButton(
      tooltip: enabled ? 'Hide NSFW content' : 'Show NSFW content',
      icon: Icon(Icons.block, color: color),
      onPressed: () async {
        try {
          await ref.read(nsfwPrefProvider.notifier).toggle();
        } catch (err) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Could not update: $err')),
            );
          }
        }
      },
    );
  }
}
