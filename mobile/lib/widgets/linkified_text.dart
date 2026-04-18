import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../screens/profile_screen.dart';

/// Auto-detects URLs, www / bare-domain shorthand, emails, @mentions,
/// and #hashtags inside [text] and renders them as tappable styled spans.
///
/// Patterns mirror `src/components/chat/linkify-text.tsx` so behavior
/// matches the web app. Hashtags are rendered as styled spans without a
/// tap target — there's no tag screen on mobile yet.
class LinkifiedText extends StatefulWidget {
  const LinkifiedText({
    super.key,
    required this.text,
    required this.baseStyle,
    required this.linkColor,
  });

  final String text;
  final TextStyle baseStyle;
  final Color linkColor;

  @override
  State<LinkifiedText> createState() => _LinkifiedTextState();
}

class _LinkifiedTextState extends State<LinkifiedText> {
  final List<TapGestureRecognizer> _recognizers = [];

  @override
  void dispose() {
    for (final r in _recognizers) {
      r.dispose();
    }
    super.dispose();
  }

  TapGestureRecognizer _newRecognizer(VoidCallback onTap) {
    final r = TapGestureRecognizer()..onTap = onTap;
    _recognizers.add(r);
    return r;
  }

  @override
  Widget build(BuildContext context) {
    // Reset recognizers each build — the widget is cheap and rebuilds
    // typically only happen on theme changes.
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();

    final spans = <InlineSpan>[];
    final matches = _combinedRegex.allMatches(widget.text).toList();
    var cursor = 0;
    final linkStyle = widget.baseStyle.copyWith(
      color: widget.linkColor,
      decoration: TextDecoration.underline,
      decorationColor: widget.linkColor,
    );

    for (final m in matches) {
      if (m.start > cursor) {
        spans.add(TextSpan(text: widget.text.substring(cursor, m.start)));
      }
      final matched = m.group(0)!;
      // Group order: 1=URL, 2=WWW, 3=EMAIL, 4=BARE_DOMAIN, 5=HASHTAG, 6=MENTION
      if (m.group(6) != null) {
        final username = m.group(6)!;
        spans.add(TextSpan(
          text: matched,
          style: linkStyle,
          recognizer: _newRecognizer(() {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => ProfileScreen(username: username)),
            );
          }),
        ));
      } else if (m.group(5) != null) {
        // Hashtag — styled, not tappable.
        spans.add(TextSpan(
          text: matched,
          style: widget.baseStyle.copyWith(
            color: widget.linkColor,
            fontWeight: FontWeight.w600,
          ),
        ));
      } else {
        String href;
        if (m.group(3) != null) {
          href = 'mailto:$matched';
        } else if (m.group(2) != null || m.group(4) != null) {
          href = 'https://$matched';
        } else {
          href = matched;
        }
        spans.add(TextSpan(
          text: matched,
          style: linkStyle,
          recognizer: _newRecognizer(() => _open(href)),
        ));
      }
      cursor = m.end;
    }
    if (cursor < widget.text.length) {
      spans.add(TextSpan(text: widget.text.substring(cursor)));
    }

    return Text.rich(
      TextSpan(style: widget.baseStyle, children: spans),
    );
  }

  Future<void> _open(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

// ── Patterns mirrored from src/components/chat/linkify-text.tsx ──────

const _urlPattern =
    r'(https?:\/\/(?:www\.)?[-\w@:%.+~#=]{1,256}\.[a-zA-Z]{2,}(?:[-\w()@:%+.~#?&\/=]*))';
const _wwwPattern =
    r'(www\.[-\w@:%.+~#=]{1,256}\.[a-zA-Z]{2,}(?:[-\w()@:%+.~#?&\/=]*))';
const _emailPattern =
    r'((?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))';
const _commonTlds =
    'com|org|net|io|co|dev|app|me|info|biz|us|uk|ca|au|de|fr|es|it|nl|ru|br|in|jp|edu|gov|mil|tv|cc|gg|xyz|ai|so|to|fm|ly|sh|gl|vc|la|ws|sx|lol';
final _bareDomainPattern =
    '((?:[-\\w]+\\.)+(?:$_commonTlds)(?:\\.\\w{2,3})?(?:[-\\w()@:%+.~#?&\\/=]*))';
// Dart RegExp doesn't support lookbehind on all platforms; instead we
// simply match the optional `@` boundary ourselves by allowing any
// preceding char and then trimming at parse time. Practically the web's
// negative-lookbehind is to prevent emails matching as mentions, but
// our combined regex matches email earlier than mention so the order
// already disambiguates.
const _hashtagPattern = r'#([a-zA-Z0-9][a-zA-Z0-9-]{0,49})';
const _mentionPattern = r'@([a-zA-Z0-9_]{3,30})';

final RegExp _combinedRegex = RegExp(
  '$_urlPattern|$_wwwPattern|$_emailPattern|$_bareDomainPattern|$_hashtagPattern|$_mentionPattern',
);

const _imageUrlExt =
    r'\.(?:jpe?g|png|gif|webp|svg|heic|heif|avif|bmp|ico)(?:\?[^\s]*)?$';
final RegExp _imageUrlRegex = RegExp(_imageUrlExt, caseSensitive: false);

/// True when the URL path ends with a common image extension.
bool isImageUrl(String url) {
  final parsed = Uri.tryParse(url);
  final path = parsed?.path ?? url;
  return _imageUrlRegex.hasMatch(path);
}

/// Extract the first http/https (or www / bare-domain) URL from [text].
/// Returns it as an absolute https URL, or null if none found. Skips
/// matches preceded by `@` so emails don't get treated as URLs.
String? extractFirstUrlFromText(String text) {
  final urlOnly = RegExp('$_urlPattern|$_wwwPattern|$_bareDomainPattern');
  for (final m in urlOnly.allMatches(text)) {
    if (m.group(1) == null && m.start > 0 && text[m.start - 1] == '@') {
      continue;
    }
    final matched = m.group(0)!;
    if (m.group(1) != null) return matched;
    return 'https://$matched';
  }
  return null;
}
