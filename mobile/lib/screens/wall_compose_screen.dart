import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';

/// Post-on-someone-else's-wall composer. Mobile sends a markdown-
/// subset string; the server synthesizes Lexical JSON with the same
/// helper we use for bios, so web renders the post with full
/// formatting even though mobile only exposes plain text here.
class WallComposeScreen extends ConsumerStatefulWidget {
  const WallComposeScreen({super.key, required this.username});

  final String username;

  @override
  ConsumerState<WallComposeScreen> createState() =>
      _WallComposeScreenState();
}

class _WallComposeScreenState extends ConsumerState<WallComposeScreen> {
  final _ctrl = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  bool get _canSubmit => _ctrl.text.trim().isNotEmpty && !_busy;

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(wallApiProvider).createWallPost(
            username: widget.username,
            content: _ctrl.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Posted on @${widget.username}\'s wall')),
      );
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() => _error = _messageFromDio(e) ?? 'Post failed. Try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Post on @${widget.username}'),
        actions: [
          TextButton(
            onPressed: _canSubmit ? _submit : null,
            child: _busy
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Post'),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _ctrl,
                autofocus: true,
                minLines: 5,
                maxLines: 12,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  hintText: 'Say something on @${widget.username}\'s wall…',
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                "Your post goes to @${widget.username}'s wall after they "
                'accept it.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.error,
                    fontSize: 13,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

String? _messageFromDio(DioException e) {
  final data = e.response?.data;
  if (data is Map && data['error'] is String) {
    return data['error'] as String;
  }
  return null;
}
