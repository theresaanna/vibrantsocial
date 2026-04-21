import 'package:dio/dio.dart';

import '../models/comment.dart';
import '../models/post.dart';

/// Input shape for the mobile composer. Mirrors the JSON body accepted
/// by `POST /api/v1/post` on the server (see `src/lib/compose.ts`).
class CreatePostInput {
  CreatePostInput({
    required this.text,
    this.tags = const [],
    this.images = const [],
    this.youtubeVideoId,
    this.poll,
    this.isNsfw = false,
    this.isSensitive = false,
    this.isGraphicNudity = false,
  });

  final String text;
  final List<String> tags;
  final List<({String src, String? altText})> images;
  final String? youtubeVideoId;
  final ({String question, List<String> options})? poll;
  final bool isNsfw;
  final bool isSensitive;
  final bool isGraphicNudity;

  Map<String, dynamic> toJson() => {
        'text': text,
        if (tags.isNotEmpty) 'tags': tags,
        if (images.isNotEmpty)
          'images': [
            for (final img in images)
              {'src': img.src, 'altText': ?img.altText},
          ],
        'youtubeVideoId': ?youtubeVideoId,
        if (poll != null)
          'poll': {
            'question': poll!.question,
            'options': [
              for (final opt in poll!.options) {'text': opt}
            ],
          },
        'isNsfw': isNsfw,
        'isSensitive': isSensitive,
        'isGraphicNudity': isGraphicNudity,
      };
}

class PostApi {
  PostApi(this._dio);

  final Dio _dio;

  /// `GET /api/v1/feed` — authenticated home timeline.
  Future<PostPage> fetchFeed({String? cursor}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/feed',
      queryParameters: cursor == null ? null : {'cursor': cursor},
    );
    return PostPage.fromJson(_requireBody(res));
  }

  /// `GET /api/v1/profile/:username/posts` — posts authored by :username.
  Future<PostPage> fetchProfilePosts({
    required String username,
    String? cursor,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/profile/${Uri.encodeComponent(username)}/posts',
      queryParameters: cursor == null ? null : {'cursor': cursor},
    );
    return PostPage.fromJson(_requireBody(res));
  }

  /// `GET /api/v1/post/:id` — single post with viewer state + the
  /// post author's resolved theme (so the detail screen can paint the
  /// author's backdrop the way their profile page does).
  Future<PostDetail> fetchPost(String id) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/post/${Uri.encodeComponent(id)}',
    );
    return PostDetail.fromJson(_requireBody(res));
  }

  /// `POST /api/v1/post` — create a new post from the mobile composer.
  Future<Post> createPost(CreatePostInput input) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/v1/post',
      data: input.toJson(),
    );
    final body = _requireBody(res);
    return Post.fromJson((body['post'] as Map).cast<String, dynamic>());
  }

  /// `POST /api/v1/compose/suggest-tags` — AI-suggested tags for the
  /// composer draft. Returns a normalized list that may overlap with
  /// tags the user has already picked — callers should de-dupe.
  Future<List<String>> suggestTags({
    required String text,
    List<String> imageUrls = const [],
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/v1/compose/suggest-tags',
      data: {
        'text': text,
        if (imageUrls.isNotEmpty) 'imageUrls': imageUrls,
      },
    );
    final body = _requireBody(res);
    return (body['tags'] as List).cast<String>();
  }

  /// `GET /api/v1/post/:id/comments` — top-level comments, oldest-first.
  Future<CommentPage> fetchComments({
    required String postId,
    String? cursor,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/post/${Uri.encodeComponent(postId)}/comments',
      queryParameters: cursor == null ? null : {'cursor': cursor},
    );
    return CommentPage.fromJson(_requireBody(res));
  }

  Map<String, dynamic> _requireBody(Response<Map<String, dynamic>> res) {
    final data = res.data;
    if (data == null) {
      throw DioException(
        requestOptions: res.requestOptions,
        response: res,
        message: 'Empty response body',
      );
    }
    return data;
  }
}
