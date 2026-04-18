import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Set of font family names we bundle as .ttf assets under
/// `assets/fonts/`. Keep in sync with the `fonts:` block in pubspec.yaml
/// and `mobile/scripts/download-username-fonts.sh`.
const Set<String> _bundledUsernameFonts = {
  'Sofadi One',
  'Jersey 10',
  'Limelight',
  'Unkempt',
  'Gugi',
  'Turret Road',
  'Nova Mono',
  'Ewert',
  'Ballet',
  'Manufacturing Consent',
  'Rubik Puddles',
  'Hachi Maru Pop',
  'Ms Madi',
  'Jacquard 24',
  'Texturina',
  'Great Vibes',
  'Rye',
  'Bonbon',
  'Agu Display',
  'Agbalumo',
};

/// Maps the slug stored on `User.usernameFont` (e.g. "manufacturing-consent")
/// to the Google-fonts family name our bundled assets and `google_fonts`
/// lookup expect (e.g. "Manufacturing Consent"). Mirror of
/// `USERNAME_FONTS` in `src/lib/profile-fonts.ts` — keep in sync.
const Map<String, String> _fontSlugToFamily = {
  'sofadi-one': 'Sofadi One',
  'jersey-10': 'Jersey 10',
  'limelight': 'Limelight',
  'unkempt': 'Unkempt',
  'gugi': 'Gugi',
  'turret-road': 'Turret Road',
  'nova-mono': 'Nova Mono',
  'ewert': 'Ewert',
  'ballet': 'Ballet',
  'manufacturing-consent': 'Manufacturing Consent',
  'rubik-puddles': 'Rubik Puddles',
  'hachi-maru-pop': 'Hachi Maru Pop',
  'ms-madi': 'Ms Madi',
  'jacquard-24': 'Jacquard 24',
  'texturina': 'Texturina',
  'great-vibes': 'Great Vibes',
  'rye': 'Rye',
  'bonbon': 'Bonbon',
  'agu-display': 'Agu Display',
  'agbalumo': 'Agbalumo',
};

/// Resolve a [fontFamily] argument that could be either a slug
/// (server-stored on `User.usernameFont`) or a fully-qualified Google
/// family name (already-resolved from `usernameFontFamily`). Returns
/// the family name to feed into `google_fonts` / our bundled-asset
/// fontFamily.
String? _resolveFamily(String? raw) {
  if (raw == null || raw.isEmpty) return null;
  return _fontSlugToFamily[raw] ?? raw;
}

/// Renders a user's display name.
///
/// The app-wide default is Lexend (w300 — see main.dart). When
/// [fontFamily] is set, the name renders in that font. Families we
/// bundle as assets are applied via a plain `TextStyle.fontFamily`;
/// anything else falls back to the runtime google_fonts lookup, with a
/// try/catch around it since the package's registry is curated.
class UsernameText extends StatelessWidget {
  const UsernameText({
    super.key,
    required this.text,
    this.fontFamily,
    this.style,
    this.overflow,
    this.maxLines,
  });

  final String text;
  final String? fontFamily;
  final TextStyle? style;
  final TextOverflow? overflow;
  final int? maxLines;

  @override
  Widget build(BuildContext context) {
    final base = style ??
        DefaultTextStyle.of(context).style.copyWith(fontWeight: FontWeight.w600);
    final effective = _styleFor(_resolveFamily(fontFamily), base);
    return Text(
      text,
      style: effective,
      overflow: overflow,
      maxLines: maxLines,
    );
  }
}

/// Process-wide cache so we only log a missing-font warning once per
/// family name — avoids spamming devtools on every list rebuild.
final Set<String> _missingFonts = <String>{};

TextStyle _styleFor(String? fontFamily, TextStyle base) {
  if (fontFamily == null) return base;
  if (_bundledUsernameFonts.contains(fontFamily)) {
    return base.copyWith(fontFamily: fontFamily);
  }
  try {
    return GoogleFonts.getFont(fontFamily, textStyle: base);
  } catch (_) {
    if (_missingFonts.add(fontFamily) && kDebugMode) {
      debugPrint(
        '[UsernameText] Font "$fontFamily" is neither bundled nor '
        'available via google_fonts — falling back to the default style.',
      );
    }
    return base;
  }
}
