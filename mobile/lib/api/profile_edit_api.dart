import 'package:dio/dio.dart';

import '../models/profile_edit.dart';

/// Edit-profile surface. GET + PUT against `/api/v1/profile/me`; live
/// username availability against `/api/v1/profile/username-check`;
/// avatar uploads against the shared `/api/avatar` endpoint (same
/// route the web app uses — it already accepts mobile bearer tokens
/// and runs the CSAM scan + Vercel Blob cleanup).
class ProfileEditApi {
  ProfileEditApi(this._dio);

  final Dio _dio;

  Future<EditableProfile> fetchMe() async {
    final res = await _dio.get<Map<String, dynamic>>('/api/v1/profile/me');
    final data = res.data;
    if (data == null) {
      throw DioException(
        requestOptions: res.requestOptions,
        response: res,
        message: 'Empty response body',
      );
    }
    final profile = data['profile'];
    if (profile is! Map) {
      throw DioException(
        requestOptions: res.requestOptions,
        response: res,
        message: 'Malformed profile payload',
      );
    }
    return EditableProfile.fromJson(profile.cast<String, dynamic>());
  }

  /// Save a partial patch. Server interprets missing keys as "leave
  /// unchanged", so we only send what actually changed.
  Future<void> save(ProfileUpdate patch) async {
    if (patch.isEmpty) return;
    await _dio.put<Map<String, dynamic>>(
      '/api/v1/profile/me',
      data: patch.toJson(),
    );
  }

  /// Check if a candidate username is available. Returns false for
  /// invalid formats too (mirrors the server's fast-path — no network
  /// round-trip for obviously-bad input is not worth the complexity
  /// on mobile; the server handles it).
  Future<bool> isUsernameAvailable(String username) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/profile/username-check',
      queryParameters: {'username': username},
    );
    return res.data?['available'] == true;
  }

  /// Avatar upload. Hits the shared `/api/avatar` route which handles
  /// CSAM scanning + auto-deletes the old blob. Returns the new URL
  /// the caller should stash in local state.
  Future<String> uploadAvatar(String filePath, {String? fileName}) async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath, filename: fileName),
    });
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/avatar',
      data: form,
    );
    final data = res.data;
    if (data == null) {
      throw DioException(
        requestOptions: res.requestOptions,
        response: res,
        message: 'Empty response body',
      );
    }
    final url = data['url'];
    if (url is! String) {
      throw DioException(
        requestOptions: res.requestOptions,
        response: res,
        message: 'Avatar upload returned no url',
      );
    }
    return url;
  }
}
