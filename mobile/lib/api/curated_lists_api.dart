import 'package:dio/dio.dart';

import '../models/curated_list.dart';
import '../models/post.dart';

/// Client for `/api/v1/lists/*`. Phase-1 scope: read + subscribe toggle.
/// Create / delete / rename / collaborators / join-requests land later.
class CuratedListsApi {
  CuratedListsApi(this._dio);

  final Dio _dio;

  /// Fetch the viewer's owned, collaborating, and subscribed lists.
  Future<CuratedListOverview> fetchOverview() async {
    final res = await _dio.get<Map<String, dynamic>>('/api/v1/lists');
    return CuratedListOverview.fromJson(res.data!);
  }

  /// Fetch one list's metadata + members + viewer role flags.
  Future<CuratedListDetail> fetchDetail(String listId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/lists/$listId',
    );
    return CuratedListDetail.fromJson(res.data!);
  }

  /// Fetch a page of posts authored by this list's members.
  Future<PostPage> fetchFeed(String listId, {String? cursor}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/lists/$listId/feed',
      queryParameters: {if (cursor != null) 'cursor': cursor},
    );
    return PostPage.fromJson(res.data!);
  }

  /// Subscribe the viewer to a list. Idempotent — POSTing again is safe.
  Future<void> subscribe(String listId) async {
    await _dio.post<void>('/api/v1/lists/$listId/subscribe');
  }

  /// Unsubscribe. Safe even when not currently subscribed.
  Future<void> unsubscribe(String listId) async {
    await _dio.delete<void>('/api/v1/lists/$listId/subscribe');
  }
}
