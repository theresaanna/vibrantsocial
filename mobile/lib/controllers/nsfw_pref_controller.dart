import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/prefs_api.dart';

/// Mirrors the web's `showNsfwContent` user preference. Bootstraps
/// from the server on first read, optimistically flips on toggle, and
/// reverts if the server call fails.
class NsfwPrefController extends StateNotifier<bool> {
  NsfwPrefController(this._api) : super(false) {
    _bootstrap();
  }

  final PrefsApi _api;

  Future<void> _bootstrap() async {
    try {
      final value = await _api.getNsfw();
      if (mounted) state = value;
    } catch (_) {
      // Leave default (false). Toggle still works — first toggle hits
      // the server and reconciles.
    }
  }

  Future<void> toggle() async {
    final previous = state;
    state = !state;
    try {
      final actual = await _api.toggleNsfw();
      state = actual;
    } catch (_) {
      state = previous;
      rethrow;
    }
  }
}
