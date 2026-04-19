import 'package:dio/dio.dart';

/// Thin wrapper around `POST /api/rpc`. Every server action registered in
/// `src/app/api/rpc/route.ts` is callable by name with a positional args
/// list matching the function's TypeScript parameters.
class RpcClient {
  RpcClient(this._dio);

  final Dio _dio;

  Future<dynamic> call(String action, List<dynamic> args) async {
    final res = await _dio.post<dynamic>(
      '/api/rpc',
      data: {'action': action, 'args': args},
    );
    return res.data;
  }

  /// Call and assert the response is a JSON object.
  Future<Map<String, dynamic>> callMap(String action, List<dynamic> args) async {
    final data = await call(action, args);
    if (data is Map) return data.cast<String, dynamic>();
    throw DioException(
      requestOptions: RequestOptions(path: '/api/rpc'),
      message: 'Expected object for action $action, got ${data.runtimeType}',
    );
  }

  /// Call and assert the response is a JSON array.
  Future<List<dynamic>> callList(String action, List<dynamic> args) async {
    final data = await call(action, args);
    if (data is List) return data;
    throw DioException(
      requestOptions: RequestOptions(path: '/api/rpc'),
      message: 'Expected array for action $action, got ${data.runtimeType}',
    );
  }
}
