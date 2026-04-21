import 'dart:convert';
import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_colorpicker/flutter_colorpicker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../api/theme_edit_api.dart';
import '../config/env.dart';
import '../models/theme_edit.dart';
import '../providers.dart';
import '../widgets/themed_background.dart';
import '../widgets/themed_container.dart';
import 'premium_screen.dart';

final themeEditApiProvider = Provider<ThemeEditApi>(
  (ref) => ThemeEditApi(ref.watch(dioProvider)),
);

final _optionsProvider =
    FutureProvider.autoDispose<ThemeOptions>((ref) {
  return ref.watch(themeEditApiProvider).fetchOptions();
});

final _presetsProvider =
    FutureProvider.autoDispose<List<CustomThemePreset>>((ref) {
  return ref.watch(themeEditApiProvider).listPresets();
});

/// Appearance editor — colors, username font, container opacity,
/// background image (preset or custom upload), AI palette generator,
/// and custom preset save/load.
///
/// Sparklefall editor + easter egg canvas land in Phase 4b.
class ThemeEditScreen extends ConsumerStatefulWidget {
  const ThemeEditScreen({super.key});

  @override
  ConsumerState<ThemeEditScreen> createState() => _ThemeEditScreenState();
}

class _ThemeEditScreenState extends ConsumerState<ThemeEditScreen> {
  String? _bgImage;
  String? _usernameFont;
  int _containerOpacity = 100;
  String? _bgColor;
  String? _textColor;
  String? _linkColor;
  String? _secondaryColor;
  String? _containerColor;

  bool _sparkleEnabled = false;
  String? _sparklePreset;
  // True once the user explicitly chose a preset in this session —
  // guards us from clobbering a web-set null (custom sparkles) back
  // to "default" just because we had to prefill the UI somehow.
  bool _sparklePresetTouched = false;
  bool _customSparklesTouched = false;
  late TextEditingController _customSparklesCtrl;
  int _sparkleInterval = 800;
  double _sparkleWind = 0;
  int _sparkleMaxSparkles = 50;
  int _sparkleMinSize = 10;
  int _sparkleMaxSize = 30;

  bool _dirty = false;
  bool _saving = false;
  bool _generating = false;
  bool _uploading = false;
  bool _primed = false;

  /// Turn a canonical background reference (as stored server-side and
  /// returned by `/api/v1/theme/options`) into a URL
  /// `CachedNetworkImage` can fetch. Preset paths start with `/` and
  /// need the API base prepended; Vercel Blob uploads come back
  /// absolute and pass through.
  String _absBgUrl(String raw) {
    if (raw.startsWith('/')) {
      final base = Env.apiBaseUrl;
      // Trim a trailing slash on base to avoid `//` in the final URL.
      return base.endsWith('/')
          ? '${base.substring(0, base.length - 1)}$raw'
          : '$base$raw';
    }
    return raw;
  }

  @override
  void initState() {
    super.initState();
    _customSparklesCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _customSparklesCtrl.dispose();
    super.dispose();
  }

  void _primeFromCurrent(Map<String, dynamic> current) {
    if (_primed) return;
    _primed = true;
    _bgImage = current['profileBgImage'] as String?;
    _usernameFont = current['usernameFont'] as String?;
    _containerOpacity =
        (current['profileContainerOpacity'] as num?)?.toInt() ?? 100;
    _bgColor = current['profileBgColor'] as String?;
    _textColor = current['profileTextColor'] as String?;
    _linkColor = current['profileLinkColor'] as String?;
    _secondaryColor = current['profileSecondaryColor'] as String?;
    _containerColor = current['profileContainerColor'] as String?;

    _sparkleEnabled = current['sparklefallEnabled'] as bool? ?? false;
    // Preserve whatever the web set. Web users with raw custom sparkles
    // (sparklefallSparkles JSON) will have preset = null; we surface
    // that faithfully so the preset row shows nothing highlighted and
    // we don't accidentally overwrite their custom glyphs on save.
    _sparklePreset = current['sparklefallPreset'] as String?;
    _sparkleInterval =
        (current['sparklefallInterval'] as num?)?.toInt() ?? 800;
    _sparkleWind =
        (current['sparklefallWind'] as num?)?.toDouble() ?? 0;
    _sparkleMaxSparkles =
        (current['sparklefallMaxSparkles'] as num?)?.toInt() ?? 50;
    _sparkleMinSize =
        (current['sparklefallMinSize'] as num?)?.toInt() ?? 10;
    _sparkleMaxSize =
        (current['sparklefallMaxSize'] as num?)?.toInt() ?? 30;
    _sparklePresetTouched = false;
    // Pretty-print whatever raw sparkles the web set so the user
    // sees their emoji separated by spaces, easy to edit.
    final rawSparkles = current['sparklefallSparkles'] as String?;
    _customSparklesCtrl.text = _decodeSparklesForUi(rawSparkles);
    _customSparklesTouched = false;
  }

  /// Turn the JSON-array-of-strings the DB stores into a space-joined
  /// glyph string for the text field. Returns "" on malformed input
  /// so the field stays empty rather than showing JSON noise.
  String _decodeSparklesForUi(String? raw) {
    if (raw == null || raw.isEmpty) return '';
    try {
      final parsed = jsonDecode(raw);
      if (parsed is List) {
        return parsed.whereType<String>().join(' ');
      }
    } catch (_) {}
    return '';
  }

  /// Parse the free-text glyph field back to the JSON shape the DB
  /// wants. Returns null for an empty input so we can clear the field.
  String? _encodeSparklesForApi(String input) {
    final glyphs = input
        .trim()
        .split(RegExp(r'\s+'))
        .where((s) => s.isNotEmpty)
        .toList();
    if (glyphs.isEmpty) return null;
    return jsonEncode(glyphs);
  }

  void _markDirty() {
    if (!_dirty) setState(() => _dirty = true);
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      // Only send the preset field if the user explicitly picked one
      // in this session — otherwise we'd clobber a web-set custom
      // sparkle selection (where preset is null by design).
      final patch = <String, dynamic>{
        'profileBgImage': _bgImage,
        'usernameFont': _usernameFont,
        'profileContainerOpacity': _containerOpacity,
        'profileBgColor': _bgColor,
        'profileTextColor': _textColor,
        'profileLinkColor': _linkColor,
        'profileSecondaryColor': _secondaryColor,
        'profileContainerColor': _containerColor,
        'sparklefallEnabled': _sparkleEnabled,
        'sparklefallInterval': _sparkleInterval,
        'sparklefallWind': _sparkleWind,
        'sparklefallMaxSparkles': _sparkleMaxSparkles,
        'sparklefallMinSize': _sparkleMinSize,
        'sparklefallMaxSize': _sparkleMaxSize,
      };
      if (_sparklePresetTouched) {
        patch['sparklefallPreset'] = _sparklePreset;
        // The resolver prefers raw `sparklefallSparkles` over the
        // preset's glyphs, so a web user who previously set custom
        // sparkles would see those instead of the preset they just
        // picked on mobile. Only clear them if the user didn't
        // separately edit the custom-glyph field this session.
        if (!_customSparklesTouched) {
          patch['sparklefallSparkles'] = null;
        }
      }
      if (_customSparklesTouched) {
        patch['sparklefallSparkles'] =
            _encodeSparklesForApi(_customSparklesCtrl.text);
      }
      await ref.read(themeEditApiProvider).update(patch);
      // Bust the theme cache so ThemedBackground repaints on next frame.
      final username =
          ref.read(sessionProvider)?.user.username;
      if (username != null) {
        ref.invalidate(profileProvider(username));
      }
      if (mounted) {
        setState(() => _dirty = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Saved')),
        );
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Save failed: $err')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickColor(String label, String? current,
      void Function(String hex) apply) async {
    Color initial = _hexToColor(current) ?? const Color(0xFFD946EF);
    final picked = await showDialog<Color>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(label),
        content: SingleChildScrollView(
          child: ColorPicker(
            pickerColor: initial,
            onColorChanged: (c) => initial = c,
            enableAlpha: false,
            displayThumbColor: true,
            paletteType: PaletteType.hsvWithHue,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(initial),
            child: const Text('Apply'),
          ),
        ],
      ),
    );
    if (picked != null) {
      setState(() => apply(_colorToHex(picked)));
      _markDirty();
    }
  }

  Future<void> _uploadCustomBackground() async {
    final picker = ImagePicker();
    final x = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 90,
    );
    if (x == null) return;
    setState(() => _uploading = true);
    try {
      final url = await ref
          .read(themeEditApiProvider)
          .uploadCustomBackground(File(x.path));
      setState(() => _bgImage = url);
      _markDirty();
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $err')),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _aiGenerate() async {
    if (_bgImage == null || _bgImage!.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Pick a background first')),
      );
      return;
    }
    setState(() => _generating = true);
    try {
      final result = await ref
          .read(themeEditApiProvider)
          .generateFromImage(_bgImage!);
      setState(() {
        _bgColor = result.colors.bg;
        _textColor = result.colors.text;
        _linkColor = result.colors.link;
        _secondaryColor = result.colors.secondary;
        _containerColor = result.colors.container;
      });
      _markDirty();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Generated: ${result.name}')),
        );
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Generate failed: $err')),
        );
      }
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  Future<void> _savePreset() async {
    if (_bgImage == null ||
        _bgColor == null ||
        _textColor == null ||
        _linkColor == null ||
        _secondaryColor == null ||
        _containerColor == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Need a background + all five colors')),
      );
      return;
    }
    final name = await _promptForName();
    if (name == null || name.isEmpty) return;
    try {
      await ref.read(themeEditApiProvider).savePreset(
            name: name,
            imageUrl: _bgImage!,
            colors: ThemeColors(
              bg: _bgColor,
              text: _textColor,
              link: _linkColor,
              secondary: _secondaryColor,
              container: _containerColor,
            ),
          );
      ref.invalidate(_presetsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Saved "$name"')));
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Save failed: $err')),
        );
      }
    }
  }

  Future<String?> _promptForName() {
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Save preset'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Preset name',
            hintText: 'e.g. Sunset vibes',
          ),
          maxLength: 50,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(ctrl.text.trim()),
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _applyPreset(CustomThemePreset preset) {
    setState(() {
      _bgImage = preset.imageUrl;
      _bgColor = preset.colors.bg;
      _textColor = preset.colors.text;
      _linkColor = preset.colors.link;
      _secondaryColor = preset.colors.secondary;
      _containerColor = preset.colors.container;
    });
    _markDirty();
  }

  Future<void> _deletePreset(CustomThemePreset preset) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Delete "${preset.name}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(themeEditApiProvider).deletePreset(preset.id);
      ref.invalidate(_presetsProvider);
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Delete failed: $err')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final options = ref.watch(_optionsProvider);
    final presets = ref.watch(_presetsProvider);
    final viewerTheme = ref.watch(viewerThemeProvider);

    return ThemedBackground(
      theme: viewerTheme,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text('Appearance'),
          backgroundColor: Colors.transparent,
          actions: [
            TextButton(
              onPressed: _saving || !_dirty ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Save'),
            ),
          ],
        ),
        body: options.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text('Couldn\'t load options.\n$e',
                  textAlign: TextAlign.center),
            ),
          ),
          data: (opts) {
            _primeFromCurrent(opts.current);
            return _buildBody(opts, presets);
          },
        ),
      ),
    );
  }

  Widget _buildBody(
    ThemeOptions opts,
    AsyncValue<List<CustomThemePreset>> presets,
  ) {
    return ListView(
      padding: const EdgeInsets.only(bottom: 32),
      children: [
        if (!opts.viewerIsPremium) _GoPremiumBanner(onTap: _openPremiumFlow),
        _backgroundSection(opts),
        _colorsSection(opts),
        _presetsSection(opts, presets),
        _fontSection(opts),
        _opacitySection(),
        _sparkleSection(opts),
      ],
    );
  }

  /// Launches the in-app subscription flow. On successful activation we
  /// refetch theme options so premium backgrounds + fonts unlock
  /// without the user having to back out and come back.
  Future<void> _openPremiumFlow() async {
    final activated = await Navigator.of(context).push<bool?>(
      MaterialPageRoute(builder: (_) => const PremiumScreen()),
    );
    if (activated == true && mounted) {
      ref.invalidate(_optionsProvider);
    }
  }

  // ─── Sections ──────────────────────────────────────────────────

  Widget _backgroundSection(ThemeOptions opts) {
    return _Section(
      title: 'Background',
      children: [
        if (_bgImage != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: CachedNetworkImage(
                  // Relative preset paths (`/backgrounds/...`) need the
                  // API base prepended before they can be fetched; blob
                  // URLs pass through unchanged.
                  imageUrl: _absBgUrl(_bgImage!),
                  fit: BoxFit.cover,
                  errorWidget: (_, _, _) => const ColoredBox(
                    color: Colors.black12,
                    child: Center(child: Icon(Icons.broken_image)),
                  ),
                ),
              ),
            ),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _bgImage == null
                      ? null
                      : () {
                          setState(() => _bgImage = null);
                          _markDirty();
                        },
                  icon: const Icon(Icons.clear),
                  label: const Text('Clear'),
                ),
              ),
              const SizedBox(width: 8),
              if (opts.viewerIsPremium)
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _uploading ? null : _uploadCustomBackground,
                    icon: _uploading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.upload),
                    label: Text(_uploading ? 'Uploading' : 'Upload'),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        // Split the catalog into free + premium rows so the distinction
        // is obvious at a glance. The flat list buried the tier under a
        // tiny amber star which wasn't clearly readable.
        _bgRow(
          label: 'Free',
          backgrounds:
              opts.backgrounds.where((b) => !b.premiumOnly).toList(growable: false),
          locked: false,
          showStar: false,
          viewerIsPremium: opts.viewerIsPremium,
        ),
        const SizedBox(height: 12),
        _bgRow(
          label: 'Premium',
          backgrounds:
              opts.backgrounds.where((b) => b.premiumOnly).toList(growable: false),
          locked: !opts.viewerIsPremium,
          showStar: false,
          viewerIsPremium: opts.viewerIsPremium,
          trailingHeaderAction: opts.viewerIsPremium
              ? null
              : TextButton(
                  onPressed: _openPremiumFlow,
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFFD946EF),
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text('Unlock'),
                ),
        ),
      ],
    );
  }

  /// One labeled horizontal strip of background thumbs. When
  /// [locked] is true the entire row is dimmed and every tap opens
  /// the premium screen instead of selecting the background.
  Widget _bgRow({
    required String label,
    required List<dynamic> backgrounds,
    required bool locked,
    required bool showStar,
    required bool viewerIsPremium,
    Widget? trailingHeaderAction,
  }) {
    if (backgrounds.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 6),
          child: Row(
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: locked
                          ? Theme.of(context).colorScheme.onSurfaceVariant
                          : null,
                    ),
              ),
              if (locked) ...[
                const SizedBox(width: 6),
                const Icon(Icons.lock, size: 14, color: Colors.grey),
              ],
              const Spacer(),
              if (trailingHeaderAction != null) trailingHeaderAction,
            ],
          ),
        ),
        SizedBox(
          height: 100,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: backgrounds.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (_, i) {
              final bg = backgrounds[i];
              final selected = _bgImage == bg.src;
              return GestureDetector(
                onTap: () {
                  if (locked) {
                    _openPremiumFlow();
                    return;
                  }
                  setState(() => _bgImage = bg.src);
                  _markDirty();
                },
                child: Opacity(
                  opacity: locked ? 0.4 : 1,
                  child: Container(
                    width: 100,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: selected
                            ? const Color(0xFFD946EF)
                            : Colors.black26,
                        width: selected ? 3 : 1,
                      ),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        CachedNetworkImage(
                          // Catalog paths are canonical (relative for
                          // presets). Absolutize for the image loader.
                          imageUrl: _absBgUrl(bg.thumbSrc),
                          fit: BoxFit.cover,
                          errorWidget: (_, _, _) =>
                              const ColoredBox(color: Colors.black12),
                        ),
                        if (locked)
                          Container(
                            alignment: Alignment.center,
                            color: Colors.black.withValues(alpha: 0.25),
                            child: const Icon(
                              Icons.lock,
                              size: 20,
                              color: Colors.white,
                            ),
                          ),
                        if (showStar && !locked)
                          const Positioned(
                            top: 4,
                            right: 4,
                            child: Icon(Icons.star,
                                size: 14, color: Colors.amber),
                          ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _colorsSection(ThemeOptions opts) {
    // Custom colors are allowed when the viewer is premium, OR when
    // they're on no background / a free preset. Uploaded blobs and
    // premium presets both require premium to tint.
    final bgIsFreePreset = _bgImage != null &&
        _bgImage!.startsWith('/backgrounds/') &&
        !_bgImage!.startsWith('/backgrounds/premium/');
    final bgIsNone = _bgImage == null || _bgImage!.isEmpty;
    final canSetColors = opts.viewerIsPremium || bgIsNone || bgIsFreePreset;

    // AI generate follows the same rule as the server: available when
    // premium OR when the source image is a free preset.
    final canGenerate = !bgIsNone && canSetColors;

    return _Section(
      title: 'Colors',
      trailing: FilledButton.icon(
        onPressed: (_generating || !canGenerate) ? null : _aiGenerate,
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFFD946EF),
        ),
        icon: _generating
            ? const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white),
              )
            : const Icon(Icons.auto_awesome, size: 16),
        label: const Text('Generate'),
      ),
      children: [
        if (!canSetColors)
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Text(
              'Custom colors are available to Premium members, or anyone '
              'using a free preset background.',
              style: TextStyle(fontSize: 12),
            ),
          ),
        _ColorRow(
          label: 'Background',
          value: _bgColor,
          enabled: canSetColors,
          onTap: () => _pickColor(
              'Background', _bgColor, (h) => _bgColor = h),
          onClear: () {
            setState(() => _bgColor = null);
            _markDirty();
          },
        ),
        _ColorRow(
          label: 'Text',
          value: _textColor,
          enabled: canSetColors,
          onTap: () =>
              _pickColor('Text', _textColor, (h) => _textColor = h),
          onClear: () {
            setState(() => _textColor = null);
            _markDirty();
          },
        ),
        _ColorRow(
          label: 'Link',
          value: _linkColor,
          enabled: canSetColors,
          onTap: () =>
              _pickColor('Link', _linkColor, (h) => _linkColor = h),
          onClear: () {
            setState(() => _linkColor = null);
            _markDirty();
          },
        ),
        _ColorRow(
          label: 'Secondary',
          value: _secondaryColor,
          enabled: canSetColors,
          onTap: () => _pickColor(
              'Secondary', _secondaryColor, (h) => _secondaryColor = h),
          onClear: () {
            setState(() => _secondaryColor = null);
            _markDirty();
          },
        ),
        _ColorRow(
          label: 'Container',
          value: _containerColor,
          enabled: canSetColors,
          onTap: () => _pickColor(
              'Container', _containerColor, (h) => _containerColor = h),
          onClear: () {
            setState(() => _containerColor = null);
            _markDirty();
          },
        ),
      ],
    );
  }

  Widget _presetsSection(
      ThemeOptions opts, AsyncValue<List<CustomThemePreset>> presets) {
    // Saving custom presets is premium-only — server returns 403 for
    // free users, so disable the button in the UI to match.
    return _Section(
      title: 'My saved themes',
      trailing: OutlinedButton.icon(
        onPressed: opts.viewerIsPremium ? _savePreset : null,
        icon: Icon(
          opts.viewerIsPremium
              ? Icons.bookmark_add_outlined
              : Icons.star_outline,
          size: 16,
        ),
        label: Text(opts.viewerIsPremium
            ? 'Save current'
            : 'Save (Premium)'),
      ),
      children: [
        presets.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (e, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: Text('Couldn\'t load presets.\n$e'),
          ),
          data: (items) => items.isEmpty
              ? const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text(
                      'No saved themes yet — save the current look above.'),
                )
              : SizedBox(
                  height: 90,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, i) {
                      final p = items[i];
                      return Stack(
                        children: [
                          GestureDetector(
                            onTap: () => _applyPreset(p),
                            child: Container(
                              width: 90,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: Colors.black26),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: Stack(
                                fit: StackFit.expand,
                                children: [
                                  CachedNetworkImage(
                                    imageUrl: p.imageUrl,
                                    fit: BoxFit.cover,
                                    errorWidget: (_, __, ___) =>
                                        const ColoredBox(color: Colors.black12),
                                  ),
                                  Positioned(
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    child: Container(
                                      padding: const EdgeInsets.all(4),
                                      color: Colors.black54,
                                      child: Text(
                                        p.name,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 10,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          Positioned(
                            top: 0,
                            right: 0,
                            child: InkWell(
                              onTap: () => _deletePreset(p),
                              child: Container(
                                padding: const EdgeInsets.all(2),
                                decoration: const BoxDecoration(
                                  color: Colors.black54,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.close,
                                    size: 12, color: Colors.white),
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }

  Widget _fontSection(ThemeOptions opts) {
    return _Section(
      title: 'Username font',
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: DropdownButton<String?>(
            isExpanded: true,
            value: _usernameFont,
            hint: const Text('Default'),
            onChanged: (v) {
              setState(() => _usernameFont = v);
              _markDirty();
            },
            items: [
              const DropdownMenuItem(
                  value: null, child: Text('Default')),
              for (final f in opts.fonts)
                DropdownMenuItem(
                  value: f.id,
                  enabled: f.tier == 'free' || opts.viewerIsPremium,
                  child: Text(
                    f.tier == 'premium' && !opts.viewerIsPremium
                        ? '${f.name} ★ Premium'
                        : f.name,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _sparkleSection(ThemeOptions opts) {
    final canCustomize = opts.viewerIsPremium;
    return _Section(
      title: 'Sparklefall',
      trailing: Switch(
        value: _sparkleEnabled,
        onChanged: (v) {
          setState(() {
            _sparkleEnabled = v;
            if (v && (_sparklePreset == null || _sparklePreset!.isEmpty)) {
              _sparklePreset = 'default';
            }
          });
          _markDirty();
        },
      ),
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: Text(
            'Fall of sparkles on your profile.',
            style: TextStyle(fontSize: 12),
          ),
        ),
        if (_sparkleEnabled) ...[
          // Preset picker — visually the same for free (default-only)
          // and premium users; free users just can't pick anything
          // other than "default".
          SizedBox(
            height: 70,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: opts.sparklefallPresets.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final p = opts.sparklefallPresets[i];
                final selected = _sparklePreset == p.id;
                final disabled = !canCustomize && p.id != 'default';
                return Opacity(
                  opacity: disabled ? 0.4 : 1,
                  child: GestureDetector(
                    onTap: disabled
                        ? null
                        : () {
                            setState(() {
                              _sparklePreset = p.id;
                              _sparklePresetTouched = true;
                            });
                            _markDirty();
                          },
                    child: Container(
                      width: 72,
                      decoration: BoxDecoration(
                        color: Colors.black12,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: selected
                              ? const Color(0xFFD946EF)
                              : Colors.transparent,
                          width: selected ? 3 : 1,
                        ),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(p.emoji,
                              style: const TextStyle(fontSize: 24)),
                          const SizedBox(height: 2),
                          Padding(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 4),
                            child: Text(
                              p.label,
                              textAlign: TextAlign.center,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 10),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          if (canCustomize) ...[
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _customSparklesCtrl,
                decoration: const InputDecoration(
                  labelText: 'Custom sparkles',
                  hintText: '✨ 💖 🌸 (space-separated)',
                  helperText:
                      'Overrides the preset above. Leave empty to use the preset.',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
                onChanged: (_) {
                  _customSparklesTouched = true;
                  _markDirty();
                },
              ),
            ),
            const SizedBox(height: 12),
            _sliderRow(
              'Rate',
              '${_sparkleInterval}ms',
              min: 100,
              max: 3000,
              divisions: 29,
              value: _sparkleInterval.toDouble(),
              onChanged: (v) {
                setState(() => _sparkleInterval = v.round());
                _markDirty();
              },
            ),
            _sliderRow(
              'Wind',
              _sparkleWind.toStringAsFixed(1),
              min: -1,
              max: 1,
              divisions: 20,
              value: _sparkleWind,
              onChanged: (v) {
                setState(() => _sparkleWind = v);
                _markDirty();
              },
            ),
            _sliderRow(
              'Max on screen',
              '$_sparkleMaxSparkles',
              min: 5,
              max: 200,
              divisions: 39,
              value: _sparkleMaxSparkles.toDouble(),
              onChanged: (v) {
                setState(() => _sparkleMaxSparkles = v.round());
                _markDirty();
              },
            ),
            _sliderRow(
              'Min size',
              '$_sparkleMinSize px',
              min: 5,
              max: 100,
              divisions: 19,
              value: _sparkleMinSize.toDouble(),
              onChanged: (v) {
                setState(() => _sparkleMinSize = v.round());
                _markDirty();
              },
            ),
            _sliderRow(
              'Max size',
              '$_sparkleMaxSize px',
              min: 5,
              max: 100,
              divisions: 19,
              value: _sparkleMaxSize.toDouble(),
              onChanged: (v) {
                setState(() => _sparkleMaxSize = v.round());
                _markDirty();
              },
            ),
          ] else
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Text(
                'Premium members can pick other presets and fine-tune '
                'the fall.',
                style: TextStyle(fontSize: 12),
              ),
            ),
        ],
      ],
    );
  }

  Widget _sliderRow(
    String label,
    String display, {
    required double min,
    required double max,
    required int divisions,
    required double value,
    required ValueChanged<double> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
      child: Row(
        children: [
          SizedBox(width: 110, child: Text(label)),
          Expanded(
            child: Slider(
              min: min,
              max: max,
              divisions: divisions,
              value: value.clamp(min, max),
              onChanged: onChanged,
            ),
          ),
          SizedBox(
            width: 60,
            child: Text(display, textAlign: TextAlign.right),
          ),
        ],
      ),
    );
  }

  Widget _opacitySection() {
    return _Section(
      title: 'Container opacity',
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              Expanded(
                child: Slider(
                  min: 80,
                  max: 100,
                  divisions: 20,
                  value: _containerOpacity.clamp(80, 100).toDouble(),
                  onChanged: (v) {
                    setState(() => _containerOpacity = v.round());
                    _markDirty();
                  },
                ),
              ),
              SizedBox(
                width: 48,
                child: Text('$_containerOpacity%',
                    textAlign: TextAlign.right),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Shared sub-widgets ──────────────────────────────────────────

/// Top-of-editor banner shown to free users, pointing at the premium
/// screen. Visible even when specific rows (backgrounds, fonts) have
/// their own disabled state — keeps the upgrade affordance prominent
/// rather than burying it under each locked tile.
class _GoPremiumBanner extends StatelessWidget {
  const _GoPremiumBanner({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            gradient: const LinearGradient(
              colors: [Color(0xFFD946EF), Color(0xFF2563EB)],
            ),
          ),
          child: Row(
            children: [
              const Icon(Icons.auto_awesome, color: Colors.white),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Unlock the full theme editor',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Premium unlocks custom colors, backgrounds, '
                      'fonts, and sparklefall.',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Colors.white),
            ],
          ),
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.children,
    this.trailing,
  });

  final String title;
  final List<Widget> children;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return ThemedContainer(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                ),
                if (trailing != null) trailing!,
              ],
            ),
          ),
          const SizedBox(height: 8),
          ...children,
        ],
      ),
    );
  }
}

class _ColorRow extends StatelessWidget {
  const _ColorRow({
    required this.label,
    required this.value,
    required this.onTap,
    required this.onClear,
    this.enabled = true,
  });

  final String label;
  final String? value;
  final VoidCallback onTap;
  final VoidCallback onClear;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final color = _hexToColor(value);
    return Opacity(
      opacity: enabled ? 1.0 : 0.5,
      child: InkWell(
        onTap: enabled ? onTap : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: color ?? Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.black26),
                ),
                child: color == null
                    ? const Icon(Icons.colorize, size: 18)
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(child: Text(label)),
              Text(value ?? '—',
                  style: const TextStyle(
                      fontFeatures: [FontFeature.tabularFigures()])),
              if (value != null && enabled)
                IconButton(
                  onPressed: onClear,
                  icon: const Icon(Icons.clear, size: 16),
                  tooltip: 'Clear',
                  visualDensity: VisualDensity.compact,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Hex helpers ────────────────────────────────────────────────

Color? _hexToColor(String? hex) {
  if (hex == null || hex.isEmpty) return null;
  final clean = hex.replaceFirst('#', '');
  if (clean.length != 6) return null;
  final v = int.tryParse(clean, radix: 16);
  if (v == null) return null;
  return Color(0xFF000000 | v);
}

String _colorToHex(Color c) {
  int asByte(double channel) => (channel * 255).round() & 0xFF;
  final r = asByte(c.r).toRadixString(16).padLeft(2, '0');
  final g = asByte(c.g).toRadixString(16).padLeft(2, '0');
  final b = asByte(c.b).toRadixString(16).padLeft(2, '0');
  return '#$r$g$b';
}
