import 'package:dio/dio.dart';

import '../models/post.dart';

/// One row of the Explore tag cloud. `postCount` is the number of
/// mobile-safe posts carrying the tag — already filtered by Play
/// policy on the server so it matches what the tag feed will render.
class TagCloudEntry {
  const TagCloudEntry({required this.name, required this.postCount});

  final String name;
  final int postCount;

  factory TagCloudEntry.fromJson(Map<String, dynamic> json) => TagCloudEntry(
        name: json['name'] as String,
        postCount: (json['postCount'] as num?)?.toInt() ?? 0,
      );
}

class TagCloudPage {
  const TagCloudPage({required this.tags, required this.hasMore});

  final List<TagCloudEntry> tags;
  final bool hasMore;

  factory TagCloudPage.fromJson(Map<String, dynamic> json) => TagCloudPage(
        tags: (json['tags'] as List)
            .cast<Map>()
            .map((m) => TagCloudEntry.fromJson(m.cast<String, dynamic>()))
            .toList(),
        hasMore: json['hasMore'] == true,
      );
}

class TagFeedPage {
  const TagFeedPage({
    required this.tag,
    required this.posts,
    required this.nextCursor,
  });

  final TagCloudEntry tag;
  final List<Post> posts;
  final String? nextCursor;

  factory TagFeedPage.fromJson(Map<String, dynamic> json) => TagFeedPage(
        tag: TagCloudEntry.fromJson((json['tag'] as Map).cast<String, dynamic>()),
        posts: (json['posts'] as List)
            .cast<Map>()
            .map((m) => Post.fromJson(m.cast<String, dynamic>()))
            .toList(),
        nextCursor: json['nextCursor'] as String?,
      );
}

/// Explore + tag browsing surfaces. Both endpoints apply Play-policy
/// filtering server-side (NSFW tags 404, tagged posts run through
/// `mobileSafePostFilter`) so the client doesn't need to re-check.
class ExploreApi {
  ExploreApi(this._dio);

  final Dio _dio;

  Future<TagCloudPage> fetchTrendingTags({
    int offset = 0,
    int limit = 50,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/explore/tags',
      queryParameters: {'offset': offset, 'limit': limit},
    );
    final data = res.data;
    if (data == null) {
      throw DioException(
        requestOptions: res.requestOptions,
        response: res,
        message: 'Empty response body',
      );
    }
    return TagCloudPage.fromJson(data);
  }

  Future<TagFeedPage> fetchTagFeed(String tagName, {String? cursor}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/tags/${Uri.encodeComponent(tagName)}/feed',
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
    return TagFeedPage.fromJson(data);
  }
}
