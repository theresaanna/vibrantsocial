import 'package:dio/dio.dart';

/// Client for `/api/v1/sparkle/*`. Phase-4b covers the click-to-earn
/// reward; more endpoints (e.g. daily-count query) can be layered on
/// later if we need to show "you've earned N/10 today" hints.
class SparkleApi {
  SparkleApi(this._dio);

  final Dio _dio;

  /// Award one star for a sparkle tap. Returns the new total on
  /// success, or throws a `DioException` with status 429 on the
  /// daily-cap hit (handled gracefully by the sparkle widget).
  Future<({int awarded, int total})> claimReward() async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/v1/sparkle/reward',
    );
    final data = res.data!;
    return (
      awarded: (data['awarded'] as num).toInt(),
      total: (data['total'] as num).toInt(),
    );
  }
}
