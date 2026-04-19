import 'dart:io';

import 'package:dio/dio.dart';
import 'package:http_parser/http_parser.dart';

import '../models/theme_edit.dart';

/// Client for the theme editor endpoints — separate from `ThemeApi`
/// which fetches a resolved theme for rendering. This one covers the
/// mutation side: options catalog, save, presets, AI generate, and
/// custom background upload.
class ThemeEditApi {
  ThemeEditApi(this._dio);

  final Dio _dio;

  /// Catalog of preset backgrounds, fonts, and sparkle presets —
  /// also reports whether the viewer is premium so the UI can gate
  /// premium-only pickers.
  Future<ThemeOptions> fetchOptions() async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/theme/options',
    );
    return ThemeOptions.fromJson(res.data!);
  }

  /// Save any subset of theme fields. Undefined keys left untouched;
  /// explicit `null` clears the field server-side.
  Future<void> update(Map<String, dynamic> patch) async {
    await _dio.post<void>('/api/v1/theme/update', data: patch);
  }

  /// List the viewer's saved custom presets.
  Future<List<CustomThemePreset>> listPresets() async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/theme/presets',
    );
    return (res.data!['presets'] as List)
        .map((p) => CustomThemePreset.fromJson(
            (p as Map).cast<String, dynamic>()))
        .toList();
  }

  /// Create or upsert a custom preset by name.
  Future<CustomThemePreset> savePreset({
    required String name,
    required String imageUrl,
    required ThemeColors colors,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/v1/theme/presets',
      data: {
        'name': name,
        'imageUrl': imageUrl,
        'colors': colors.toJson(),
      },
    );
    return CustomThemePreset.fromJson(
      (res.data!['preset'] as Map).cast<String, dynamic>(),
    );
  }

  Future<void> deletePreset(String id) async {
    await _dio.delete<void>('/api/v1/theme/presets/$id');
  }

  /// Generate a complementary palette from a background image via
  /// Anthropic Claude. Returns the 5 colors + a suggested theme name.
  Future<({String name, ThemeColors colors})> generateFromImage(
    String imageUrl,
  ) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/v1/theme/generate',
      data: {'imageUrl': imageUrl},
    );
    final data = res.data!;
    return (
      name: (data['name'] as String?) ?? 'Custom Theme',
      colors: ThemeColors.fromJson(
        (data['colors'] as Map).cast<String, dynamic>(),
      ),
    );
  }

  /// Upload a custom background image. Goes through the same endpoint
  /// the web uses (/api/profile-background) which runs Arachnid Shield
  /// CSAM scanning + puts the blob on Vercel. Returns the stored URL.
  Future<String> uploadCustomBackground(File file) async {
    final filename = file.path.split('/').last;
    final mimeType = _mimeTypeFor(filename) ?? 'image/jpeg';
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        file.path,
        filename: filename,
        contentType: MediaType.parse(mimeType),
      ),
    });
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/profile-background',
      data: form,
      options: Options(contentType: 'multipart/form-data'),
    );
    final url = res.data?['url'] as String?;
    if (url == null || url.isEmpty) {
      throw DioException(
        requestOptions: res.requestOptions,
        response: res,
        message: 'Upload returned no URL',
      );
    }
    return url;
  }

  String? _mimeTypeFor(String filename) {
    final lower = filename.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    return null;
  }
}
