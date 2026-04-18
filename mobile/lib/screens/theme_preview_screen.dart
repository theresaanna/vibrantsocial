import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/resolved_theme.dart';
import '../providers.dart' show userThemeProvider, sessionProvider;

/// Smoke-test screen: type a username, fetch the resolved theme from the
/// VibrantSocial API, and render the pieces that land. Useful as a sanity
/// check that the whole web→API→mobile pipeline agrees on a format.
class ThemePreviewScreen extends ConsumerStatefulWidget {
  const ThemePreviewScreen({super.key});

  @override
  ConsumerState<ThemePreviewScreen> createState() =>
      _ThemePreviewScreenState();
}

class _ThemePreviewScreenState extends ConsumerState<ThemePreviewScreen> {
  final _controller = TextEditingController();
  String? _submittedUsername;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final value = _controller.text.trim().toLowerCase();
    if (value.isEmpty) return;
    setState(() => _submittedUsername = value);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Theme preview'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(sessionProvider.notifier).clear(),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    textInputAction: TextInputAction.go,
                    autocorrect: false,
                    decoration: const InputDecoration(
                      labelText: 'username',
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: (_) => _submit(),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(onPressed: _submit, child: const Text('Fetch')),
              ],
            ),
            const SizedBox(height: 24),
            Expanded(
              child: _submittedUsername == null
                  ? const Center(child: Text('Enter a username to fetch.'))
                  : _ThemeResult(username: _submittedUsername!),
            ),
          ],
        ),
      ),
    );
  }
}

class _ThemeResult extends ConsumerWidget {
  const _ThemeResult({required this.username});

  final String username;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(userThemeProvider(username));
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(
        child: Text('Error: $err', style: const TextStyle(color: Colors.red)),
      ),
      data: (response) => _ThemePreviewBody(response: response),
    );
  }
}

class _ThemePreviewBody extends StatelessWidget {
  const _ThemePreviewBody({required this.response});

  final ThemeResponse response;

  @override
  Widget build(BuildContext context) {
    final theme = response.theme;
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '@${response.username}',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 4),
          Text('version ${theme.version} · hasCustomTheme: ${theme.hasCustomTheme}'),
          const SizedBox(height: 16),
          _Section(
            title: 'Colors',
            child: _ColorSwatches(colors: theme.colors),
          ),
          _Section(
            title: 'Container',
            child: Text('opacity ${theme.container.opacity}%'),
          ),
          if (theme.background != null)
            _Section(
              title: 'Background',
              child: _BackgroundPreview(bg: theme.background!),
            ),
          if (theme.font != null)
            _Section(
              title: 'Font',
              child: Text(
                '${theme.font!.name} (${theme.font!.tier}) — id: ${theme.font!.id}',
              ),
            ),
          if (theme.frame != null)
            _Section(
              title: 'Frame',
              child: _FramePreview(frame: theme.frame!),
            ),
          if (theme.sparklefall != null)
            _Section(
              title: 'Sparklefall',
              child: _SparklefallSummary(sf: theme.sparklefall!),
            ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.1,
                ),
          ),
          const SizedBox(height: 6),
          child,
        ],
      ),
    );
  }
}

class _ColorSwatches extends StatelessWidget {
  const _ColorSwatches({required this.colors});

  final ResolvedColors colors;

  @override
  Widget build(BuildContext context) {
    final entries = <(String, Color, String)>[
      ('bg', colors.bgColor, colors.bg),
      ('text', colors.textColor, colors.text),
      ('link', colors.linkColor, colors.link),
      ('secondary', colors.secondaryColor, colors.secondary),
      ('container', colors.containerColor, colors.container),
    ];
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final (label, color, hex) in entries)
          Column(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.black26),
                ),
              ),
              const SizedBox(height: 4),
              Text(label, style: const TextStyle(fontSize: 11)),
              Text(hex, style: const TextStyle(fontSize: 10, color: Colors.black54)),
            ],
          ),
      ],
    );
  }
}

class _BackgroundPreview extends StatelessWidget {
  const _BackgroundPreview({required this.bg});

  final ResolvedBackground bg;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          height: 140,
          decoration: BoxDecoration(
            border: Border.all(color: Colors.black26),
            borderRadius: BorderRadius.circular(8),
            image: DecorationImage(
              image: NetworkImage(bg.imageUrl),
              repeat: switch (bg.repeat) {
                BgRepeat.repeat => ImageRepeat.repeat,
                BgRepeat.repeatX => ImageRepeat.repeatX,
                BgRepeat.repeatY => ImageRepeat.repeatY,
                BgRepeat.noRepeat => ImageRepeat.noRepeat,
              },
              fit: bg.size == 'cover'
                  ? BoxFit.cover
                  : bg.size == 'contain'
                      ? BoxFit.contain
                      : BoxFit.fill,
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '${bg.repeat.name} · ${bg.attachment.name} · ${bg.size} · ${bg.position}',
          style: const TextStyle(fontSize: 12, color: Colors.black54),
        ),
      ],
    );
  }
}

class _FramePreview extends StatelessWidget {
  const _FramePreview({required this.frame});

  final ResolvedFrame frame;

  @override
  Widget build(BuildContext context) {
    final isSvg = frame.imageUrl.toLowerCase().endsWith('.svg');
    return Row(
      children: [
        SizedBox(
          width: 96,
          height: 96,
          child: isSvg
              ? const Center(
                  child: Text('SVG', style: TextStyle(color: Colors.black54)),
                )
              : Image.network(frame.imageUrl, fit: BoxFit.contain),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(frame.name),
              Text('id: ${frame.id} · ${frame.category}',
                  style: const TextStyle(fontSize: 12, color: Colors.black54)),
              Text(
                'scale ${frame.scaleX}×${frame.scaleY} · offset ${frame.offsetX},${frame.offsetY}',
                style: const TextStyle(fontSize: 12, color: Colors.black54),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SparklefallSummary extends StatelessWidget {
  const _SparklefallSummary({required this.sf});

  final ResolvedSparklefall sf;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'reason: ${sf.reason.name}${sf.presetId != null ? ' · preset: ${sf.presetId}' : ''}',
          style: const TextStyle(fontSize: 12, color: Colors.black54),
        ),
        const SizedBox(height: 4),
        Text(sf.sparkles.join(' '), style: const TextStyle(fontSize: 22)),
        const SizedBox(height: 4),
        Text(
          'interval ${sf.interval}ms · wind ${sf.wind} · max ${sf.maxSparkles} · size ${sf.minSize}–${sf.maxSize}',
          style: const TextStyle(fontSize: 12, color: Colors.black54),
        ),
      ],
    );
  }
}
