import 'package:dio/dio.dart';

import '../models/resolved_theme.dart';

/// Thin wrapper over the `GET /api/v1/theme/:username` endpoint.
class ThemeApi {
  ThemeApi(this._dio);

  final Dio _dio;

  /// Fetches the resolved theme for [username]. Throws on non-200 responses
  /// — callers are responsible for translating errors into UI state.
  Future<ThemeResponse> fetch(String username) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/theme/${Uri.encodeComponent(username)}',
    );
    final data = response.data;
    if (data == null) {
      throw DioException(
        requestOptions: response.requestOptions,
        response: response,
        message: 'Empty response body',
      );
    }
    return ThemeResponse.fromJson(data);
  }
}
