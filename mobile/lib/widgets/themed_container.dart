import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';

/// Rounded container painted with the signed-in viewer's theme color +
/// opacity, sitting on top of [ThemedBackground]. Mirrors the look of
/// [PostCard] so chat surfaces match the rest of the app.
///
/// When the viewer has no custom theme yet, falls back to the Material
/// surface color so the container is still visible.
class ThemedContainer extends ConsumerWidget {
  const ThemedContainer({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.borderRadius = 16,
    this.onTap,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double borderRadius;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final viewerTheme = ref.watch(viewerThemeProvider);
    final colors = viewerTheme?.colors;
    final opacity = viewerTheme?.container.opacity ?? 100;
    final containerColor = colors == null
        ? Theme.of(context).colorScheme.surface
        : colors.containerColor.withValues(alpha: opacity.clamp(0, 100) / 100.0);
    final textColor =
        colors?.textColor ?? Theme.of(context).colorScheme.onSurface;

    final radius = BorderRadius.circular(borderRadius);
    Widget body = DefaultTextStyle.merge(
      style: TextStyle(color: textColor),
      child: padding == null ? child : Padding(padding: padding!, child: child),
    );
    final tap = onTap;
    if (tap != null) {
      body = InkWell(onTap: tap, borderRadius: radius, child: body);
    }
    final material = Material(
      color: containerColor,
      borderRadius: radius,
      clipBehavior: Clip.antiAlias,
      child: body,
    );
    return margin == null ? material : Padding(padding: margin!, child: material);
  }
}
