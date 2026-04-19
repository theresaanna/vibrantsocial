import 'package:dio/dio.dart';

import '../models/marketplace.dart';

/// Client for `/api/v1/marketplace/*`. Paginated grid + single listing
/// detail (listing + Q&A). Q&A mutations land in a later phase.
class MarketplaceApi {
  MarketplaceApi(this._dio);

  final Dio _dio;

  /// Fetch a page of listings ordered newest-first. Pass `cursor` from
  /// the previous page's `nextCursor` to continue; null on the first
  /// page.
  Future<MarketplacePage> fetchPage({String? cursor}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/marketplace/feed',
      queryParameters: {if (cursor != null) 'cursor': cursor},
    );
    return MarketplacePage.fromJson(res.data!);
  }

  /// Fetch a single listing by post id, with its Q&A thread.
  Future<MarketplaceDetail> fetchDetail(String postId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/marketplace/$postId',
    );
    return MarketplaceDetail.fromJson(res.data!);
  }
}
