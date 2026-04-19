import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../models/resolved_theme.dart';

/// Paints the ambient theme (bg color + bg image, with the same tiling
/// semantics as the web app) behind its [child]. Use this to wrap the
/// body of any screen that should honour the user's theme — the
/// signed-in viewer on feed / list / post-detail screens, or the
/// profile owner on their own profile.
///
/// Passing a null theme is a no-op: the child renders on the app's
/// default scaffold background.
class ThemedBackground extends StatelessWidget {
  const ThemedBackground({super.key, required this.theme, required this.child});

  final ResolvedTheme? theme;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final t = theme;
    if (t == null) return child;
    final bg = t.background;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: t.colors.bgColor,
        image: bg == null ? null : bgDecorationImage(bg),
      ),
      child: child,
    );
  }
}

/// Translate [ResolvedBackground] into a Flutter [DecorationImage]. The
/// exported helper is shared with the profile screen so both paths keep
/// the same tiling / fit behaviour.
///
/// Key rule: `BoxFit` is mutually exclusive with tiling. When the server
/// says `repeat` isn't `noRepeat`, we skip `fit` so the image keeps its
/// natural size and the pattern tiles.
DecorationImage bgDecorationImage(ResolvedBackground bg) {
  final repeat = switch (bg.repeat) {
    BgRepeat.repeat => ImageRepeat.repeat,
    BgRepeat.repeatX => ImageRepeat.repeatX,
    BgRepeat.repeatY => ImageRepeat.repeatY,
    BgRepeat.noRepeat => ImageRepeat.noRepeat,
  };
  final tiling = repeat != ImageRepeat.noRepeat;
  return DecorationImage(
    image: CachedNetworkImageProvider(bg.imageUrl),
    repeat: repeat,
    fit: tiling
        ? null
        : bg.size == 'cover'
            ? BoxFit.cover
            : bg.size == 'contain'
                ? BoxFit.contain
                : BoxFit.fill,
  );
}
