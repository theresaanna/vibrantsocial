import 'rpc_client.dart';

/// Reads and writes the viewer's content prefs (NSFW visibility for now;
/// future toggles can land alongside).
class PrefsApi {
  PrefsApi(this._rpc);

  final RpcClient _rpc;

  Future<bool> getNsfw() async {
    final value = await _rpc.call('getNsfwContentSetting', const []);
    if (value is bool) return value;
    return false;
  }

  /// Returns the new value after toggle.
  Future<bool> toggleNsfw() async {
    final data = await _rpc.callMap('toggleNsfwContent', const []);
    return data['showNsfwContent'] as bool? ?? false;
  }
}
