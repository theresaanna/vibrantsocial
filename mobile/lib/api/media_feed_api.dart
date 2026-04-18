import '../models/media.dart';
import 'rpc_client.dart';

/// Wraps the server's `fetchMediaFeed` and `fetchProfileMedia` RPC
/// actions. Both return `MediaPostPage` (id, author, createdAt, items).
class MediaFeedApi {
  MediaFeedApi(this._rpc);

  final RpcClient _rpc;

  Future<MediaPostPage> fetchFeed({String? cursor}) async {
    final data = await _rpc.callMap('fetchMediaFeed', [cursor]);
    return MediaPostPage.fromJson(data);
  }

  Future<MediaPostPage> fetchProfile(String username, {String? cursor}) async {
    final data = await _rpc.callMap('fetchProfileMedia', [username, cursor]);
    return MediaPostPage.fromJson(data);
  }
}
