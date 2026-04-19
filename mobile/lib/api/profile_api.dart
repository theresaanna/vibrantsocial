import 'package:dio/dio.dart';

import '../models/profile.dart';
import '../models/user_list.dart';

/// Which follow-style list to fetch for a profile.
enum ProfileListKind { followers, following, friends }

/// Thin wrapper over the `/api/v1/profile/*` endpoints.
class ProfileApi {
  ProfileApi(this._dio);

  final Dio _dio;

  /// Fetch a profile by username. The server treats the call as optionally
  /// authenticated: if the Dio auth interceptor attaches a token, the
  /// `relationship` block will reflect the viewer.
  Future<ProfileResponse> fetch(String username) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/profile/${Uri.encodeComponent(username)}',
    );
    final data = res.data;
    if (data == null) {
      throw DioException(
        requestOptions: res.requestOptions,
        response: res,
        message: 'Empty response body',
      );
    }
    return ProfileResponse.fromJson(data);
  }

  /// Fetch a page of a profile's follow-style list. Pass [cursor] to load
  /// subsequent pages — the server returns `null` in `nextCursor` when the
  /// list has been exhausted.
  Future<UserListPage> fetchList({
    required String username,
    required ProfileListKind kind,
    String? cursor,
  }) async {
    final path =
        '/api/v1/profile/${Uri.encodeComponent(username)}/${kind.name}';
    final res = await _dio.get<Map<String, dynamic>>(
      path,
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
    return UserListPage.fromJson(data);
  }
}
