import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_colorpicker/flutter_colorpicker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../api/theme_edit_api.dart';
import '../models/theme_edit.dart';
import '../providers.dart';
import '../widgets/themed_background.dart';
import '../widgets/themed_container.dart';

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

  bool _dirty = false;
  bool _saving = false;
  bool _generating = false;
  bool _uploading = false;
  bool _primed = false;

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
  }

  void _markDirty() {
    if (!_dirty) setState(() => _dirty = true);
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      await ref.read(themeEditApiProvider).update({
        'profileBgImage': _bgImage,
        'usernameFont': _usernameFont,
        'profileContainerOpacity': _containerOpacity,
        'profileBgColor': _bgColor,
        'profileTextColor': _textColor,
        'profileLinkColor': _linkColor,
        'profileSecondaryColor': _secondaryColor,
        'profileContainerColor': _containerColor,
      });
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
        _backgroundSection(opts),
        _colorsSection(opts),
        _presetsSection(opts, presets),
        _fontSection(opts),
        _opacitySection(),
      ],
    );
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
                  imageUrl: _bgImage!,
                  fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => const ColoredBox(
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
        SizedBox(
          height: 100,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: opts.backgrounds.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (_, i) {
              final bg = opts.backgrounds[i];
              final disabled = bg.premiumOnly && !opts.viewerIsPremium;
              final selected = _bgImage == bg.src;
              return GestureDetector(
                onTap: disabled
                    ? null
                    : () {
                        setState(() => _bgImage = bg.src);
                        _markDirty();
                      },
                child: Opacity(
                  opacity: disabled ? 0.4 : 1,
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
                          imageUrl: bg.thumbSrc,
                          fit: BoxFit.cover,
                          errorWidget: (_, __, ___) =>
                              const ColoredBox(color: Colors.black12),
                        ),
                        if (bg.premiumOnly)
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
