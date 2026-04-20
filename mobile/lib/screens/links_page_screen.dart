import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/links_page.dart';
import '../models/resolved_theme.dart';
import '../providers.dart';
import '../widgets/themed_background.dart';

/// In-app editor for the viewer's links.vibrantsocial.app/{username}
/// page. Mirrors the web `/profile/links` form scope: enable toggle,
/// 300-char bio, ordered title+url rows. The web-only in-app-browser-
/// hiding toggle (`sensitiveLinks`) is intentionally absent — the
/// server preserves the stored value when we don't send the key.
class LinksPageScreen extends ConsumerStatefulWidget {
  const LinksPageScreen({super.key});

  @override
  ConsumerState<LinksPageScreen> createState() => _LinksPageScreenState();
}

class _LinksPageScreenState extends ConsumerState<LinksPageScreen> {
  static const int _bioMax = 300;
  static const int _titleMax = 100;
  static const int _linksMax = 50;

  late Future<LinksPageConfig> _load;
  LinksPageConfig? _original;

  bool _enabled = false;
  final _bioCtl = TextEditingController();

  // Each editable row owns its controllers so we don't reset cursor
  // position on every rebuild.
  final List<_LinkRow> _rows = [];

  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load = ref.read(linksPageApiProvider).fetch();
    _load.then(_hydrate).catchError((_) {});
  }

  @override
  void dispose() {
    _bioCtl.dispose();
    for (final r in _rows) {
      r.dispose();
    }
    super.dispose();
  }

  void _hydrate(LinksPageConfig config) {
    if (!mounted) return;
    setState(() {
      _original = config;
      _enabled = config.enabled;
      _bioCtl.text = config.bio ?? '';
      for (final r in _rows) {
        r.dispose();
      }
      _rows
        ..clear()
        ..addAll(config.entries.map(_LinkRow.fromEntry));
    });
  }

  // ---------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------

  List<LinksPageEntry> _currentEntries() {
    return _rows
        .map((r) => LinksPageEntry(title: r.title.text.trim(), url: r.url.text.trim()))
        .where((e) => e.title.isNotEmpty || e.url.isNotEmpty)
        .toList(growable: false);
  }

  bool _entriesDiffer(List<LinksPageEntry> a, List<LinksPageEntry> b) {
    if (a.length != b.length) return true;
    for (var i = 0; i < a.length; i++) {
      if (a[i].title != b[i].title || a[i].url != b[i].url) return true;
    }
    return false;
  }

  String? _validate(List<LinksPageEntry> entries) {
    if (entries.length > _linksMax) {
      return 'Links limited to $_linksMax entries.';
    }
    for (final e in entries) {
      if (e.title.isEmpty || e.url.isEmpty) {
        return 'Every link needs both a title and a URL.';
      }
      if (e.title.length > _titleMax) {
        return 'Titles are limited to $_titleMax characters.';
      }
      final uri = Uri.tryParse(e.url);
      if (uri == null || (uri.scheme != 'http' && uri.scheme != 'https')) {
        return 'URLs must start with http:// or https://.';
      }
    }
    return null;
  }

  Future<void> _save() async {
    if (_saving || _original == null) return;
    final entries = _currentEntries();
    final err = _validate(entries);
    if (err != null) {
      setState(() => _error = err);
      return;
    }

    // Only send keys that actually changed.
    bool? enabledPatch;
    String? bioPatch;
    bool clearBio = false;
    List<LinksPageEntry>? entriesPatch;

    if (_enabled != _original!.enabled) enabledPatch = _enabled;
    final newBio = _bioCtl.text.trim();
    final oldBio = _original!.bio ?? '';
    if (newBio != oldBio) {
      if (newBio.isEmpty) {
        clearBio = true;
      } else {
        bioPatch = newBio.length > _bioMax ? newBio.substring(0, _bioMax) : newBio;
      }
    }
    if (_entriesDiffer(entries, _original!.entries)) entriesPatch = entries;

    if (enabledPatch == null &&
        bioPatch == null &&
        !clearBio &&
        entriesPatch == null) {
      _snack('Nothing to save.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(linksPageApiProvider).save(
            enabled: enabledPatch,
            bio: bioPatch,
            clearBio: clearBio,
            entries: entriesPatch,
          );
      if (!mounted) return;
      _snack('Links page saved');
      // Refresh from the server so ids on newly-added rows are hydrated
      // and the diff baseline resets.
      final fresh = await ref.read(linksPageApiProvider).fetch();
      if (mounted) _hydrate(fresh);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Save failed: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _snack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  // ---------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final viewerTheme = ref.watch(viewerThemeProvider);
    final textColor = viewerTheme?.colors.textColor;

    return ThemedBackground(
      theme: viewerTheme,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text('Links page'),
          backgroundColor: Colors.transparent,
          foregroundColor: textColor,
          actions: [
            TextButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Save'),
            ),
          ],
        ),
        body: FutureBuilder<LinksPageConfig>(
          future: _load,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError || snap.data == null) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text("Couldn't load your links page."),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: () {
                          setState(() {
                            _load = ref.read(linksPageApiProvider).fetch();
                          });
                          _load.then(_hydrate).catchError((_) {});
                        },
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              );
            }
            return DefaultTextStyle.merge(
              style: textColor == null
                  ? const TextStyle()
                  : TextStyle(color: textColor),
              child: _buildForm(snap.data!, viewerTheme),
            );
          },
        ),
      ),
    );
  }

  Widget _buildForm(LinksPageConfig config, ResolvedTheme? theme) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 48),
      children: [
        _ThemedCard(
          theme: theme,
          child: SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Enable links page'),
            subtitle: Text(
              'Public at links.vibrantsocial.app/${_usernameHint()}. '
              'Turn off to hide the page (it\'ll 404).',
            ),
            value: _enabled,
            onChanged: (v) => setState(() => _enabled = v),
          ),
        ),
        const SizedBox(height: 12),
        _ThemedCard(
          theme: theme,
          child: TextField(
            controller: _bioCtl,
            maxLength: _bioMax,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'Bio',
              border: OutlineInputBorder(),
              helperText:
                  'Shown above your links. Plain text, 300 characters max.',
            ),
          ),
        ),
        const SizedBox(height: 12),
        _ThemedCard(
          theme: theme,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Links (${_rows.length}/$_linksMax)',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  if (_rows.length < _linksMax)
                    TextButton.icon(
                      onPressed: () {
                        setState(() {
                          _rows.add(_LinkRow.empty());
                        });
                      },
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('Add link'),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              if (_rows.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Text(
                    'No links yet. Tap "Add link" to create your first.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
              for (var i = 0; i < _rows.length; i++) ...[
                _LinkRowEditor(
                  row: _rows[i],
                  index: i,
                  onMoveUp: i == 0
                      ? null
                      : () => setState(() {
                            final r = _rows.removeAt(i);
                            _rows.insert(i - 1, r);
                          }),
                  onMoveDown: i == _rows.length - 1
                      ? null
                      : () => setState(() {
                            final r = _rows.removeAt(i);
                            _rows.insert(i + 1, r);
                          }),
                  onDelete: () => setState(() {
                    _rows.removeAt(i).dispose();
                  }),
                ),
                const SizedBox(height: 10),
              ],
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    _error!,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _ThemedCard(
          theme: theme,
          child: OutlinedButton.icon(
            onPressed: () async {
              final username = _usernameHint();
              if (username == 'username') return;
              await launchUrl(
                Uri.parse('https://links.vibrantsocial.app/$username'),
                mode: LaunchMode.externalApplication,
              );
            },
            icon: const Icon(Icons.open_in_new, size: 16),
            label: Text(
              _enabled ? 'View public page' : 'Preview (currently hidden)',
            ),
          ),
        ),
      ],
    );
  }

  String _usernameHint() {
    final session = ref.read(sessionProvider);
    return session?.user.username ?? 'username';
  }
}

/// Rounded section card that adopts the viewer's theme colors. Matches
/// `edit_profile_screen.dart`'s `_ThemedCard`. Kept as a local copy for
/// now; promote to a shared widget when a third screen needs it.
class _ThemedCard extends StatelessWidget {
  const _ThemedCard({required this.theme, required this.child});

  final ResolvedTheme? theme;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final t = theme;
    final fallback = Theme.of(context).colorScheme.surface;
    final color = t == null
        ? fallback
        : t.colors.containerColor
            .withValues(alpha: t.container.opacity.clamp(0, 100) / 100.0);
    return Material(
      color: color,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: child,
      ),
    );
  }
}

/// Owns the `TextEditingController`s for a single row so edits don't
/// lose cursor position when the parent rebuilds.
class _LinkRow {
  _LinkRow({this.id, String title = '', String url = ''})
      : title = TextEditingController(text: title),
        url = TextEditingController(text: url);

  factory _LinkRow.empty() => _LinkRow();
  factory _LinkRow.fromEntry(LinksPageEntry e) =>
      _LinkRow(id: e.id, title: e.title, url: e.url);

  final String? id;
  final TextEditingController title;
  final TextEditingController url;

  void dispose() {
    title.dispose();
    url.dispose();
  }
}

class _LinkRowEditor extends StatelessWidget {
  const _LinkRowEditor({
    required this.row,
    required this.index,
    required this.onMoveUp,
    required this.onMoveDown,
    required this.onDelete,
  });

  final _LinkRow row;
  final int index;
  final VoidCallback? onMoveUp;
  final VoidCallback? onMoveDown;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final borderColor = Theme.of(context).colorScheme.outlineVariant;
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: borderColor),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.fromLTRB(12, 8, 4, 12),
      child: Column(
        children: [
          Row(
            children: [
              Text(
                '#${index + 1}',
                style: Theme.of(context).textTheme.labelMedium,
              ),
              const Spacer(),
              IconButton(
                tooltip: 'Move up',
                visualDensity: VisualDensity.compact,
                onPressed: onMoveUp,
                icon: const Icon(Icons.arrow_upward, size: 18),
              ),
              IconButton(
                tooltip: 'Move down',
                visualDensity: VisualDensity.compact,
                onPressed: onMoveDown,
                icon: const Icon(Icons.arrow_downward, size: 18),
              ),
              IconButton(
                tooltip: 'Remove',
                visualDensity: VisualDensity.compact,
                color: Theme.of(context).colorScheme.error,
                onPressed: onDelete,
                icon: const Icon(Icons.delete_outline, size: 20),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Column(
              children: [
                TextField(
                  controller: row.title,
                  maxLength: 100,
                  decoration: const InputDecoration(
                    labelText: 'Title',
                    border: OutlineInputBorder(),
                    counterText: '',
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: row.url,
                  keyboardType: TextInputType.url,
                  decoration: const InputDecoration(
                    labelText: 'URL',
                    border: OutlineInputBorder(),
                    hintText: 'https://example.com/me',
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
