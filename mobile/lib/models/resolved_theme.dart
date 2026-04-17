import 'dart:ui';

/// Mirrors the wire format returned by `GET /api/v1/theme/:username` on the
/// server (see `src/lib/theme-resolver.ts`). Keep these dataclasses in sync
/// with the TypeScript types — the `version` field guards breaking changes.
class ResolvedTheme {
  ResolvedTheme({
    required this.version,
    required this.hasCustomTheme,
    required this.colors,
    required this.container,
    required this.background,
    required this.font,
    required this.frame,
    required this.sparklefall,
  });

  final int version;
  final bool hasCustomTheme;
  final ResolvedColors colors;
  final ResolvedContainer container;
  final ResolvedBackground? background;
  final ResolvedFont? font;
  final ResolvedFrame? frame;
  final ResolvedSparklefall? sparklefall;

  factory ResolvedTheme.fromJson(Map<String, dynamic> json) {
    return ResolvedTheme(
      version: json['version'] as int,
      hasCustomTheme: json['hasCustomTheme'] as bool,
      colors: ResolvedColors.fromJson(
        (json['colors'] as Map).cast<String, dynamic>(),
      ),
      container: ResolvedContainer.fromJson(
        (json['container'] as Map).cast<String, dynamic>(),
      ),
      background: json['background'] == null
          ? null
          : ResolvedBackground.fromJson(
              (json['background'] as Map).cast<String, dynamic>(),
            ),
      font: json['font'] == null
          ? null
          : ResolvedFont.fromJson(
              (json['font'] as Map).cast<String, dynamic>(),
            ),
      frame: json['frame'] == null
          ? null
          : ResolvedFrame.fromJson(
              (json['frame'] as Map).cast<String, dynamic>(),
            ),
      sparklefall: json['sparklefall'] == null
          ? null
          : ResolvedSparklefall.fromJson(
              (json['sparklefall'] as Map).cast<String, dynamic>(),
            ),
    );
  }
}

class ResolvedColors {
  ResolvedColors({
    required this.bg,
    required this.text,
    required this.link,
    required this.secondary,
    required this.container,
  });

  final String bg;
  final String text;
  final String link;
  final String secondary;
  final String container;

  factory ResolvedColors.fromJson(Map<String, dynamic> json) {
    return ResolvedColors(
      bg: json['bg'] as String,
      text: json['text'] as String,
      link: json['link'] as String,
      secondary: json['secondary'] as String,
      container: json['container'] as String,
    );
  }

  Color get bgColor => _parseHex(bg);
  Color get textColor => _parseHex(text);
  Color get linkColor => _parseHex(link);
  Color get secondaryColor => _parseHex(secondary);
  Color get containerColor => _parseHex(container);
}

class ResolvedContainer {
  ResolvedContainer({required this.opacity});

  /// 0–100.
  final int opacity;

  factory ResolvedContainer.fromJson(Map<String, dynamic> json) {
    return ResolvedContainer(opacity: json['opacity'] as int);
  }
}

enum BgRepeat { repeat, repeatX, repeatY, noRepeat }

enum BgAttachment { scroll, fixed }

/// Free-form; server guarantees one of "cover" | "contain" | "auto" | "100% 100%".
/// Keep as a string so we stay forward-compatible.
typedef BgSize = String;

/// Free-form; server guarantees one of the valid CSS background-position
/// keyword pairs.
typedef BgPosition = String;

class ResolvedBackground {
  ResolvedBackground({
    required this.imageUrl,
    required this.repeat,
    required this.attachment,
    required this.size,
    required this.position,
  });

  final String imageUrl;
  final BgRepeat repeat;
  final BgAttachment attachment;
  final BgSize size;
  final BgPosition position;

  factory ResolvedBackground.fromJson(Map<String, dynamic> json) {
    return ResolvedBackground(
      imageUrl: json['imageUrl'] as String,
      repeat: _parseRepeat(json['repeat'] as String),
      attachment: _parseAttachment(json['attachment'] as String),
      size: json['size'] as String,
      position: json['position'] as String,
    );
  }
}

class ResolvedFont {
  ResolvedFont({
    required this.id,
    required this.name,
    required this.googleFamily,
    required this.tier,
    required this.cssUrl,
  });

  final String id;
  final String name;
  final String googleFamily;
  final String tier; // "free" | "premium"
  final String cssUrl;

  factory ResolvedFont.fromJson(Map<String, dynamic> json) {
    return ResolvedFont(
      id: json['id'] as String,
      name: json['name'] as String,
      googleFamily: json['googleFamily'] as String,
      tier: json['tier'] as String,
      cssUrl: json['cssUrl'] as String,
    );
  }
}

class ResolvedFrame {
  ResolvedFrame({
    required this.id,
    required this.name,
    required this.imageUrl,
    required this.category,
    required this.scaleX,
    required this.scaleY,
    required this.offsetX,
    required this.offsetY,
    required this.frameScale,
  });

  final String id;
  final String name;
  final String imageUrl;
  final String category;
  final double scaleX;
  final double scaleY;
  final double offsetX;
  final double offsetY;
  final double frameScale;

  factory ResolvedFrame.fromJson(Map<String, dynamic> json) {
    return ResolvedFrame(
      id: json['id'] as String,
      name: json['name'] as String,
      imageUrl: json['imageUrl'] as String,
      category: json['category'] as String,
      scaleX: (json['scaleX'] as num).toDouble(),
      scaleY: (json['scaleY'] as num).toDouble(),
      offsetX: (json['offsetX'] as num).toDouble(),
      offsetY: (json['offsetY'] as num).toDouble(),
      frameScale: (json['frameScale'] as num).toDouble(),
    );
  }
}

enum SparklefallReason { user, birthday }

class ResolvedSparklefall {
  ResolvedSparklefall({
    required this.enabled,
    required this.presetId,
    required this.sparkles,
    required this.colors,
    required this.interval,
    required this.wind,
    required this.maxSparkles,
    required this.minSize,
    required this.maxSize,
    required this.reason,
  });

  final bool enabled;
  final String? presetId;
  final List<String> sparkles;
  final List<String> colors;
  final int interval;
  final double wind;
  final int maxSparkles;
  final int minSize;
  final int maxSize;
  final SparklefallReason reason;

  factory ResolvedSparklefall.fromJson(Map<String, dynamic> json) {
    return ResolvedSparklefall(
      enabled: json['enabled'] as bool,
      presetId: json['presetId'] as String?,
      sparkles: (json['sparkles'] as List).cast<String>(),
      colors: (json['colors'] as List).cast<String>(),
      interval: json['interval'] as int,
      wind: (json['wind'] as num).toDouble(),
      maxSparkles: json['maxSparkles'] as int,
      minSize: json['minSize'] as int,
      maxSize: json['maxSize'] as int,
      reason: json['reason'] == 'birthday'
          ? SparklefallReason.birthday
          : SparklefallReason.user,
    );
  }
}

/// Response envelope returned by `/api/v1/theme/:username`.
class ThemeResponse {
  ThemeResponse({required this.username, required this.theme});

  final String username;
  final ResolvedTheme theme;

  factory ThemeResponse.fromJson(Map<String, dynamic> json) {
    return ThemeResponse(
      username: json['username'] as String,
      theme: ResolvedTheme.fromJson(
        (json['theme'] as Map).cast<String, dynamic>(),
      ),
    );
  }
}

// ---- internal helpers ----

Color _parseHex(String hex) {
  var h = hex.replaceFirst('#', '');
  if (h.length == 3) {
    h = h.split('').map((c) => '$c$c').join();
  }
  if (h.length == 6) {
    h = 'FF$h';
  }
  return Color(int.parse(h, radix: 16));
}

BgRepeat _parseRepeat(String raw) {
  switch (raw) {
    case 'repeat':
      return BgRepeat.repeat;
    case 'repeat-x':
      return BgRepeat.repeatX;
    case 'repeat-y':
      return BgRepeat.repeatY;
    default:
      return BgRepeat.noRepeat;
  }
}

BgAttachment _parseAttachment(String raw) {
  return raw == 'fixed' ? BgAttachment.fixed : BgAttachment.scroll;
}
