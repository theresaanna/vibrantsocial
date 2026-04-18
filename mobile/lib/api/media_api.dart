import 'package:dio/dio.dart';

/// Shape of the `/api/upload` server response.
class UploadedMedia {
  UploadedMedia({
    required this.url,
    required this.fileType,
    required this.fileName,
    required this.fileSize,
  });

  final String url;
  final String fileType;
  final String fileName;
  final int fileSize;

  factory UploadedMedia.fromJson(Map<String, dynamic> json) {
    return UploadedMedia(
      url: json['url'] as String,
      fileType: json['fileType'] as String,
      fileName: json['fileName'] as String,
      fileSize: json['fileSize'] as int,
    );
  }
}

/// Wrapper around the shared `/api/upload` multipart endpoint. The same
/// route backs web uploads; the mobile JWT is attached by the Dio auth
/// interceptor so no extra config is needed here.
class MediaApi {
  MediaApi(this._dio);

  final Dio _dio;

  Future<UploadedMedia> uploadImage(String filePath, {String? fileName}) async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath, filename: fileName),
    });
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/upload',
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
    return UploadedMedia.fromJson(data);
  }
}
