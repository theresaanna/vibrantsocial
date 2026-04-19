import 'package:dio/dio.dart';

/// Client for `/api/v1/notifications/mobile-device` — tells the server
/// which Ably-assigned device id belongs to the signed-in viewer so
/// `createNotification()` can fan out native pushes.
class PushApi {
  PushApi(this._dio);

  final Dio _dio;

  /// Register (or refresh) a device. Safe to call on every app start once
  /// the Ably push activation reports a deviceId.
  Future<void> register({
    required String ablyDeviceId,
    required String platform,
    String? appVersion,
  }) async {
    await _dio.post<void>(
      '/api/v1/notifications/mobile-device',
      data: {
        'ablyDeviceId': ablyDeviceId,
        'platform': platform,
        'appVersion': ?appVersion,
      },
    );
  }

  /// Unregister on sign-out so the departing user doesn't receive pushes
  /// for the next person who signs in on this device before Ably reissues.
  Future<void> unregister({required String ablyDeviceId}) async {
    await _dio.delete<void>(
      '/api/v1/notifications/mobile-device',
      data: {'ablyDeviceId': ablyDeviceId},
    );
  }
}
