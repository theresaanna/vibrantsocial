import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persistence for the mobile JWT. Backed by Keychain on iOS and
/// EncryptedSharedPreferences on Android so the token survives app restarts
/// without living in plain storage.
class TokenStore {
  TokenStore({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  final FlutterSecureStorage _storage;

  static const _tokenKey = 'mobile_jwt';

  Future<String?> read() => _storage.read(key: _tokenKey);

  Future<void> write(String token) =>
      _storage.write(key: _tokenKey, value: token);

  Future<void> clear() => _storage.delete(key: _tokenKey);
}
