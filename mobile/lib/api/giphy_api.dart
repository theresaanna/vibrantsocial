import 'package:dio/dio.dart';

/// One search result from the Giphy proxy. `url` is the full-res GIF,
/// `previewUrl` is a mid-res loop good for the picker grid, `thumbUrl`
/// is the smallest we'll show (fallback when grid cells are tight).
class GifEntry {
  const GifEntry({
    required this.id,
    required this.url,
    required this.previewUrl,
    required this.thumbUrl,
    required this.width,
    required this.height,
    required this.title,
  });

  final String id;
  final String url;
  final String previewUrl;
  final String thumbUrl;
  final int? width;
  final int? height;
  final String title;

  double get aspectRatio {
    final w = width, h = height;
    if (w == null || h == null || w <= 0 || h <= 0) return 1;
    return w / h;
  }

  factory GifEntry.fromJson(Map<String, dynamic> json) => GifEntry(
        id: json['id'] as String,
        url: json['url'] as String,
        previewUrl: (json['previewUrl'] as String?) ?? json['url'] as String,
        thumbUrl: (json['thumbUrl'] as String?) ?? json['url'] as String,
        width: (json['width'] as num?)?.toInt(),
        height: (json['height'] as num?)?.toInt(),
        title: (json['title'] as String?) ?? '',
      );
}

class GifPage {
  const GifPage({
    required this.gifs,
    required this.nextOffset,
    required this.hasMore,
  });

  final List<GifEntry> gifs;
  final int nextOffset;
  final bool hasMore;

  factory GifPage.fromJson(Map<String, dynamic> json) => GifPage(
        gifs: (json['gifs'] as List)
            .cast<Map>()
            .map((m) => GifEntry.fromJson(m.cast<String, dynamic>()))
            .toList(),
        nextOffset: (json['offset'] as num?)?.toInt() ?? 0,
        hasMore: json['hasMore'] == true,
      );
}

/// Giphy client. Hits the server proxy (`/api/v1/giphy`) rather than
/// Giphy directly — keeps the key server-side and lets the server
/// force `rating=pg-13` on every request.
class GiphyApi {
  GiphyApi(this._dio);

  final Dio _dio;

  Future<GifPage> fetch({String? query, int offset = 0}) async {
    final trimmed = query?.trim();
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/giphy',
      queryParameters: {
        if (trimmed != null && trimmed.isNotEmpty) 'q': trimmed,
        'offset': offset,
      },
    );
    final data = res.data;
    if (data == null) {
      throw DioException(
        requestOptions: res.requestOptions,
        response: res,
        message: 'Empty response body',
      );
    }
    return GifPage.fromJson(data);
  }
}
