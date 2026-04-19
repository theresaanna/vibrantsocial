import 'dart:async';

import 'package:dio/dio.dart';

import '../services/token_store.dart';

/// Dio interceptor that:
///   1. Attaches the current JWT as `Authorization: Bearer …` on every request.
///   2. Clears the stored token on a 401 so the UI falls back to the login
///      gate. Callers that care about reacting to expiry subscribe via
///      [onUnauthorized].
class AuthInterceptor extends Interceptor {
  AuthInterceptor(this._tokenStore, {this.onUnauthorized});

  final TokenStore _tokenStore;

  /// Invoked after the token is cleared in response to a 401. Use this to
  /// notify upstream state (e.g. flip `sessionProvider` back to null).
  final FutureOr<void> Function()? onUnauthorized;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _tokenStore.read();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode == 401) {
      await _tokenStore.clear();
      if (onUnauthorized != null) {
        await onUnauthorized!();
      }
    }
    handler.next(err);
  }
}
