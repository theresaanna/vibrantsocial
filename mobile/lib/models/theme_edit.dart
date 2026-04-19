/// Flutter-side types for the appearance / theme editor.
///
/// Mirrors the shapes served by `/api/v1/theme/*`.

class ThemeBackgroundOption {
  ThemeBackgroundOption({
    required this.id,
    required this.name,
    required this.src,
    required this.thumbSrc,
    required this.category,
    required this.premiumOnly,
  });

  final String id;
  final String name;
  final String src;
  final String thumbSrc;
  /// `"pattern"` or `"photo"`.
  final String category;
  final bool premiumOnly;

  factory ThemeBackgroundOption.fromJson(Map<String, dynamic> json) {
    return ThemeBackgroundOption(
      id: json['id'] as String,
      name: json['name'] as String,
      src: json['src'] as String,
      thumbSrc: json['thumbSrc'] as String,
      category: json['category'] as String,
      premiumOnly: json['premiumOnly'] as bool,
    );
  }
}

class ThemeFontOption {
  ThemeFontOption({
    required this.id,
    required this.name,
    required this.googleFamily,
    required this.tier,
  });

  final String id;
  final String name;
  final String googleFamily;
  /// `"free"` or `"premium"`.
  final String tier;

  factory ThemeFontOption.fromJson(Map<String, dynamic> json) {
    return ThemeFontOption(
      id: json['id'] as String,
      name: json['name'] as String,
      googleFamily: json['googleFamily'] as String,
      tier: json['tier'] as String,
    );
  }
}

class SparklefallPresetOption {
  SparklefallPresetOption({
    required this.id,
    required this.label,
    required this.emoji,
    required this.sparkles,
  });

  final String id;
  final String label;
  final String emoji;
  final List<String> sparkles;

  factory SparklefallPresetOption.fromJson(Map<String, dynamic> json) {
    return SparklefallPresetOption(
      id: json['id'] as String,
      label: json['label'] as String,
      emoji: json['emoji'] as String,
      sparkles:
          (json['sparkles'] as List).map((s) => s as String).toList(),
    );
  }
}

/// Full catalog returned by `GET /api/v1/theme/options`. Drives the
/// background grid, font dropdown, and sparkle preset row.
class ThemeOptions {
  ThemeOptions({
    required this.backgrounds,
    required this.fonts,
    required this.sparklefallPresets,
    required this.viewerIsPremium,
    required this.current,
  });

  final List<ThemeBackgroundOption> backgrounds;
  final List<ThemeFontOption> fonts;
  final List<SparklefallPresetOption> sparklefallPresets;
  final bool viewerIsPremium;

  /// Viewer's existing raw theme state — used to prefill the editor.
  /// Keys match the User column names so we can pass the payload
  /// straight back to `/api/v1/theme/update` without translation.
  final Map<String, dynamic> current;

  factory ThemeOptions.fromJson(Map<String, dynamic> json) {
    return ThemeOptions(
      backgrounds: (json['backgrounds'] as List)
          .map((b) => ThemeBackgroundOption.fromJson(
              (b as Map).cast<String, dynamic>()))
          .toList(),
      fonts: (json['fonts'] as List)
          .map((f) => ThemeFontOption.fromJson(
              (f as Map).cast<String, dynamic>()))
          .toList(),
      sparklefallPresets: (json['sparklefallPresets'] as List)
          .map((s) => SparklefallPresetOption.fromJson(
              (s as Map).cast<String, dynamic>()))
          .toList(),
      viewerIsPremium: json['viewerIsPremium'] as bool,
      current: (json['current'] as Map).cast<String, dynamic>(),
    );
  }
}

/// The 5 theme colors as hex strings (e.g. `"#D946EF"`).
class ThemeColors {
  ThemeColors({
    required this.bg,
    required this.text,
    required this.link,
    required this.secondary,
    required this.container,
  });

  final String? bg;
  final String? text;
  final String? link;
  final String? secondary;
  final String? container;

  factory ThemeColors.fromJson(Map<String, dynamic> json) {
    return ThemeColors(
      bg: json['profileBgColor'] as String?,
      text: json['profileTextColor'] as String?,
      link: json['profileLinkColor'] as String?,
      secondary: json['profileSecondaryColor'] as String?,
      container: json['profileContainerColor'] as String?,
    );
  }

  Map<String, String?> toJson() => {
        'profileBgColor': bg,
        'profileTextColor': text,
        'profileLinkColor': link,
        'profileSecondaryColor': secondary,
        'profileContainerColor': container,
      };
}

class CustomThemePreset {
  CustomThemePreset({
    required this.id,
    required this.name,
    required this.imageUrl,
    required this.colors,
    required this.createdAt,
  });

  final String id;
  final String name;
  final String imageUrl;
  final ThemeColors colors;
  final DateTime createdAt;

  factory CustomThemePreset.fromJson(Map<String, dynamic> json) {
    return CustomThemePreset(
      id: json['id'] as String,
      name: json['name'] as String,
      imageUrl: json['imageUrl'] as String,
      colors: ThemeColors.fromJson(
        (json['colors'] as Map).cast<String, dynamic>(),
      ),
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
              DateTime.now(),
    );
  }
}
