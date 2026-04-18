import '../models/avatar_frame.dart';
import 'rpc_client.dart';

/// One-shot fetch of the full avatar-frame catalog. Server returns
/// resolved metadata (id, absolute imageUrl, geometry) for each
/// installed frame; client caches the result by id so chat bubbles
/// and other surfaces can map a `profileFrameId` -> AvatarFrame
/// without a per-render network call.
class AvatarFramesApi {
  AvatarFramesApi(this._rpc);

  final RpcClient _rpc;

  Future<Map<String, AvatarFrame>> fetchAll() async {
    final list = await _rpc.callList('getAvatarFrames', const []);
    final frames = list
        .map((f) => AvatarFrame.fromJson((f as Map).cast<String, dynamic>()))
        .toList();
    return {for (final f in frames) f.id: f};
  }
}
