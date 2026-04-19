import 'package:dio/dio.dart';

import '../config/env.dart';
import '../services/token_store.dart';
import 'auth_interceptor.dart';

/// Builds the shared Dio instance, installing the auth interceptor so every
/// request picks up the current JWT and reacts to 401s consistently.
///
/// The interceptor's [AuthInterceptor.onUnauthorized] hook lets providers
/// register a session-reset callback without a circular import — callers
/// pass in whatever needs to happen when the server rejects the token.
Dio buildDio({
  required TokenStore tokenStore,
  Future<void> Function()? onUnauthorized,
}) {
  final dio = Dio(
    BaseOptions(
      baseUrl: Env.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      responseType: ResponseType.json,
      headers: {
        'Accept': 'application/json',
      },
      // Treat 4xx as exceptions so the interceptor sees 401s and callers
      // get a DioException rather than having to branch on statusCode.
      validateStatus: (status) => status != null && status >= 200 && status < 300,
    ),
  );
  dio.interceptors.add(
    AuthInterceptor(tokenStore, onUnauthorized: onUnauthorized),
  );
  return dio;
}
