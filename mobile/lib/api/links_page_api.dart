import 'package:dio/dio.dart';

import '../models/links_page.dart';

/// Links-page editor API. Backs the mobile `/profile/links` equivalent
/// via `GET/PUT /api/v1/profile/links`. The server refuses unknown
/// keys so we never need to send the in-app-browser-hiding toggle
/// (`sensitiveLinks`) — that stays web-only.
class LinksPageApi {
  LinksPageApi(this._dio);

  final Dio _dio;

  Future<LinksPageConfig> fetch() async {
    final res = await _dio.get<Map<String, dynamic>>('/api/v1/profile/links');
    final data = res.data;
    if (data == null) {
      throw DioException(
        requestOptions: res.requestOptions,
        response: res,
        message: 'Empty response body',
      );
    }
    return LinksPageConfig.fromJson(data);
  }

  /// Save whatever the caller touched. Keys omitted from the map are
  /// preserved server-side — matches `updateLinksPageFromJson`'s
  /// partial-patch semantics.
  Future<void> save({
    bool? enabled,
    String? bio,
    bool clearBio = false,
    List<LinksPageEntry>? entries,
  }) async {
    final body = <String, Object?>{};
    if (enabled != null) body['enabled'] = enabled;
    if (clearBio) {
      body['bio'] = null;
    } else if (bio != null) {
      body['bio'] = bio;
    }
    if (entries != null) {
      body['links'] = entries
          .map((e) => {'title': e.title, 'url': e.url})
          .toList(growable: false);
    }
    if (body.isEmpty) return;
    await _dio.put<Map<String, dynamic>>(
      '/api/v1/profile/links',
      data: body,
    );
  }
}
