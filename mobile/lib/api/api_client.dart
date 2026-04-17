import 'package:dio/dio.dart';

import '../config/env.dart';

/// Shared Dio instance configured against the VibrantSocial API.
///
/// Kept minimal for now — interceptors for auth, tracing, and retries will
/// layer on as we add those features. Callers should use this singleton via
/// the riverpod `apiClientProvider` so tests can override it.
Dio buildDio() {
  final dio = Dio(
    BaseOptions(
      baseUrl: Env.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      responseType: ResponseType.json,
      headers: {
        'Accept': 'application/json',
      },
    ),
  );
  return dio;
}
