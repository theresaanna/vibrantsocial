import 'package:dio/dio.dart';

import '../models/session.dart';

/// Error thrown when the server indicates 2FA is required for a login.
/// Callers should route to a 2FA prompt and complete the flow separately.
class TwoFactorRequired implements Exception {
  TwoFactorRequired(this.pendingToken);
  final String pendingToken;
}

/// First-sign-in extras that the Apple native SDK surfaces separately from
/// the ID token — the server persists these when creating the account.
class AppleExtras {
  AppleExtras({this.givenName, this.familyName, this.email});
  final String? givenName;
  final String? familyName;
  final String? email;

  Map<String, dynamic> toJson() => {
        if (givenName != null) 'givenName': givenName,
        if (familyName != null) 'familyName': familyName,
        if (email != null) 'email': email,
      };
}

/// Thin wrapper over `/api/v1/auth/*`. Returns [Session] on success and
/// throws typed exceptions on protocol-level failure cases.
class AuthApi {
  AuthApi(this._dio);

  final Dio _dio;

  /// `POST /api/v1/auth/login` — email + password.
  Future<Session> login({
    required String email,
    required String password,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/v1/auth/login',
      data: {'email': email, 'password': password},
    );
    final data = res.data ?? const {};
    if (data['requires2fa'] == true) {
      throw TwoFactorRequired(data['pendingToken'] as String);
    }
    return _sessionFromJson(data);
  }

  /// `POST /api/v1/auth/signup` — creates the account and returns a session.
  /// [dateOfBirth] is sent as ISO `YYYY-MM-DD` for the server-side age gate.
  Future<Session> signup({
    required String email,
    required String password,
    required String username,
    required DateTime dateOfBirth,
  }) async {
    final dob = dateOfBirth.toIso8601String().split('T').first;
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/v1/auth/signup',
      data: {
        'email': email,
        'password': password,
        'username': username,
        'dateOfBirth': dob,
      },
    );
    return _sessionFromJson(res.data ?? const {});
  }

  /// `POST /api/v1/auth/2fa/verify` — exchange a pending token from login
  /// together with a TOTP code (or backup code, when [useBackup] is true) for
  /// a full session.
  Future<Session> verifyTwoFactor({
    required String pendingToken,
    required String code,
    bool useBackup = false,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/v1/auth/2fa/verify',
      data: {
        'pendingToken': pendingToken,
        'code': code,
        if (useBackup) 'mode': 'backup',
      },
    );
    return _sessionFromJson(res.data ?? const {});
  }

  /// `POST /api/v1/auth/oauth/native` — exchange a provider-issued ID
  /// token (Google / Apple) for a mobile session.
  Future<Session> oauthNative({
    required String provider,
    required String idToken,
    AppleExtras? apple,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/v1/auth/oauth/native',
      data: {
        'provider': provider,
        'idToken': idToken,
        if (apple != null) 'apple': apple.toJson(),
      },
    );
    return _sessionFromJson(res.data ?? const {});
  }

  /// `GET /api/v1/auth/me` — validates the stored token and returns the
  /// current user shape. Throws on 401 (the interceptor will have already
  /// cleared the bad token).
  Future<MobileUser> me() async {
    final res = await _dio.get<Map<String, dynamic>>('/api/v1/auth/me');
    final data = res.data ?? const {};
    final user = data['user'] as Map?;
    if (user == null) {
      throw DioException(
        requestOptions: res.requestOptions,
        response: res,
        message: 'Missing user payload',
      );
    }
    return MobileUser.fromJson(user.cast<String, dynamic>());
  }

  Session _sessionFromJson(Map<String, dynamic> data) {
    final token = data['token'] as String?;
    final user = data['user'] as Map?;
    if (token == null || user == null) {
      throw DioException(
        requestOptions: RequestOptions(path: '/api/v1/auth'),
        message: 'Malformed auth response',
      );
    }
    return Session(
      token: token,
      user: MobileUser.fromJson(user.cast<String, dynamic>()),
    );
  }
}
