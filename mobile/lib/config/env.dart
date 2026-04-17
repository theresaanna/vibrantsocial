/// Runtime configuration, resolved at build time via `--dart-define`.
///
/// Override for local dev against a LAN IP:
/// ```
/// flutter run --dart-define=API_BASE_URL=http://192.168.1.42:3000
/// ```
class Env {
  /// Base URL of the VibrantSocial API. Defaults to localhost for the iOS
  /// simulator; Android emulators should override to `http://10.0.2.2:3000`
  /// and physical devices to the host machine's LAN IP.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );
}
