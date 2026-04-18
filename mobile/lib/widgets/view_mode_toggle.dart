import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';

/// Two-button segmented control: Posts ↔ Media. Visually pulls from the
/// viewer's theme colors so it sits cohesively on top of the themed
/// background. Mirrors `src/components/feed-view-toggle.tsx`.
enum FeedViewMode { posts, media }

class ViewModeToggle extends ConsumerWidget {
  const ViewModeToggle({
    super.key,
    required this.mode,
    required this.onChanged,
  });

  final FeedViewMode mode;
  final ValueChanged<FeedViewMode> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colors = ref.watch(viewerThemeProvider)?.colors;
    final activeBg = colors?.containerColor ?? theme.colorScheme.surface;
    final activeText = colors?.textColor ?? theme.colorScheme.onSurface;
    final inactiveText =
        (colors?.secondaryColor ?? theme.colorScheme.onSurface.withValues(alpha: 0.7));

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Material(
        color: activeBg.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(999),
        child: Row(
          children: [
            Expanded(
              child: _Tab(
                label: 'Posts',
                icon: Icons.article_outlined,
                active: mode == FeedViewMode.posts,
                activeBg: activeBg,
                activeText: activeText,
                inactiveText: inactiveText,
                onTap: () => onChanged(FeedViewMode.posts),
              ),
            ),
            Expanded(
              child: _Tab(
                label: 'Media',
                icon: Icons.grid_view_outlined,
                active: mode == FeedViewMode.media,
                activeBg: activeBg,
                activeText: activeText,
                inactiveText: inactiveText,
                onTap: () => onChanged(FeedViewMode.media),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({
    required this.label,
    required this.icon,
    required this.active,
    required this.activeBg,
    required this.activeText,
    required this.inactiveText,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool active;
  final Color activeBg;
  final Color activeText;
  final Color inactiveText;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = active ? activeText : inactiveText;
    return Material(
      color: active ? activeBg : Colors.transparent,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 13),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
