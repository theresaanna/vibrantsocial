import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/giphy_api.dart';
import '../providers.dart';

/// Opens a full-height bottom-sheet Giphy picker and returns the
/// `GifEntry` the user tapped — or null if they dismissed.
///
/// Search is debounced 400ms so keystrokes don't hammer Giphy. Every
/// query passes through `/api/v1/giphy`, which forces `rating=pg-13`
/// regardless of what the client asks for (Play policy).
Future<GifEntry?> pickGif(BuildContext context) {
  return showModalBottomSheet<GifEntry>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, scrollController) => _GifPickerSheet(
        scrollController: scrollController,
      ),
    ),
  );
}

class _GifPickerSheet extends ConsumerStatefulWidget {
  const _GifPickerSheet({required this.scrollController});

  final ScrollController scrollController;

  @override
  ConsumerState<_GifPickerSheet> createState() => _GifPickerSheetState();
}

class _GifPickerSheetState extends ConsumerState<_GifPickerSheet> {
  final _queryCtrl = TextEditingController();
  Timer? _debounce;
  String _query = '';
  int _requestId = 0;

  final List<GifEntry> _gifs = [];
  int _offset = 0;
  bool _loading = false;
  bool _exhausted = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    widget.scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _reload();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _queryCtrl.dispose();
    widget.scrollController.removeListener(_onScroll);
    super.dispose();
  }

  void _onScroll() {
    if (_loading || _exhausted) return;
    if (widget.scrollController.position.extentAfter < 400) _loadMore();
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      if (!mounted) return;
      if (value.trim() == _query) return;
      setState(() => _query = value.trim());
      _reload();
    });
  }

  /// Reset the paginated state and fetch page zero for the current
  /// query. Uses a request id so a slow first page can't clobber a
  /// fresh second query's results.
  Future<void> _reload() async {
    final rid = ++_requestId;
    setState(() {
      _gifs.clear();
      _offset = 0;
      _exhausted = false;
      _error = null;
      _loading = true;
    });
    try {
      final page = await ref
          .read(giphyApiProvider)
          .fetch(query: _query, offset: 0);
      if (!mounted || rid != _requestId) return;
      setState(() {
        _gifs.addAll(page.gifs);
        _offset = page.nextOffset;
        _exhausted = !page.hasMore;
      });
    } catch (err) {
      if (!mounted || rid != _requestId) return;
      setState(() => _error = err);
    } finally {
      if (mounted && rid == _requestId) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    if (_loading) return;
    final rid = _requestId;
    setState(() => _loading = true);
    try {
      final page = await ref
          .read(giphyApiProvider)
          .fetch(query: _query, offset: _offset);
      if (!mounted || rid != _requestId) return;
      setState(() {
        _gifs.addAll(page.gifs);
        _offset = page.nextOffset;
        _exhausted = !page.hasMore;
      });
    } catch (err) {
      if (!mounted || rid != _requestId) return;
      setState(() => _error = err);
    } finally {
      if (mounted && rid == _requestId) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          child: TextField(
            controller: _queryCtrl,
            autofocus: true,
            onChanged: _onQueryChanged,
            onSubmitted: (v) {
              _debounce?.cancel();
              if (v.trim() != _query) {
                setState(() => _query = v.trim());
                _reload();
              }
            },
            decoration: InputDecoration(
              hintText: 'Search GIFs',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(999),
              ),
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
            ),
          ),
        ),
        Expanded(child: _body()),
        // Attribution — Giphy's terms require "Powered By GIPHY"
        // somewhere visible in the integration.
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          child: Text(
            'Powered by GIPHY',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ),
      ],
    );
  }

  Widget _body() {
    if (_error != null && _gifs.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48),
              const SizedBox(height: 12),
              Text(
                'Couldn\'t load GIFs.\n$_error',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              FilledButton(onPressed: _reload, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }
    if (_gifs.isEmpty && _loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_gifs.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            _query.isEmpty
                ? 'Trending GIFs load automatically.'
                : 'No GIFs for "$_query".',
            textAlign: TextAlign.center,
          ),
        ),
      );
    }
    return GridView.builder(
      controller: widget.scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 6,
        crossAxisSpacing: 6,
        childAspectRatio: 1,
      ),
      itemCount: _gifs.length + (_loading && !_exhausted ? 1 : 0),
      itemBuilder: (context, i) {
        if (i >= _gifs.length) {
          return const Center(child: CircularProgressIndicator());
        }
        final gif = _gifs[i];
        return GestureDetector(
          onTap: () => Navigator.of(context).pop(gif),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: CachedNetworkImage(
              imageUrl: gif.previewUrl,
              fit: BoxFit.cover,
              placeholder: (_, _) => ColoredBox(
                color: Theme.of(context)
                    .colorScheme
                    .surfaceContainerHighest,
              ),
              errorWidget: (_, _, _) => const ColoredBox(
                color: Colors.black12,
                child: Center(child: Icon(Icons.broken_image)),
              ),
            ),
          ),
        );
      },
    );
  }
}
