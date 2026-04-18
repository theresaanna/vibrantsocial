import '../models/link_preview.dart';
import 'rpc_client.dart';

/// Calls `fetchLinkPreview` on the server. Server caches results in Redis
/// for 7 days, so callers can fire freely on render without dedup logic.
class LinkPreviewApi {
  LinkPreviewApi(this._rpc);

  final RpcClient _rpc;

  Future<LinkPreviewData?> fetch(String url) async {
    final data = await _rpc.call('fetchLinkPreview', [url]);
    if (data is Map) {
      return LinkPreviewData.fromJson(data.cast<String, dynamic>());
    }
    return null;
  }
}
