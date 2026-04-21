import 'package:dio/dio.dart';

import '../models/wall_post.dart';

/// Wall posts API.
///
/// Endpoints:
///   GET    /api/v1/profile/:username/wall
///   POST   /api/v1/profile/:username/wall
///   PATCH  /api/v1/wall/:id/status
///   DELETE /api/v1/wall/:id
class WallApi {
  WallApi(this._dio);

  final Dio _dio;

  Future<WallPostPage> fetchWall(String username, {String? cursor}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/profile/${Uri.encodeComponent(username)}/wall',
      queryParameters: cursor == null ? null : {'cursor': cursor},
    );
    final data = res.data;
    if (data == null) {
      throw DioException(
        requestOptions: res.requestOptions,
        response: res,
        message: 'Empty response body',
      );
    }
    return WallPostPage.fromJson(data);
  }

  /// Mobile sends a markdown-subset string — the server synthesizes
  /// Lexical JSON before storing so the public profile renders the
  /// post in the same rich format web posts use.
  Future<void> createWallPost({
    required String username,
    required String content,
  }) async {
    await _dio.post<Map<String, dynamic>>(
      '/api/v1/profile/${Uri.encodeComponent(username)}/wall',
      data: {'content': content},
    );
  }

  /// Accept a pending wall post or hide an accepted one. Wall owner
  /// only — the server enforces, the UI hides the buttons otherwise.
  Future<void> setStatus({
    required String wallPostId,
    required String status,
  }) async {
    await _dio.patch<Map<String, dynamic>>(
      '/api/v1/wall/${Uri.encodeComponent(wallPostId)}/status',
      data: {'status': status},
    );
  }

  /// Either the post author or the wall owner can delete.
  Future<void> deleteWallPost(String wallPostId) async {
    await _dio.delete<Map<String, dynamic>>(
      '/api/v1/wall/${Uri.encodeComponent(wallPostId)}',
    );
  }
}
