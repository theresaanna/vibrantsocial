/// Runtime configuration, resolved at build time via `--dart-define`.
///
/// Override for local dev against a LAN IP:
/// ```
/// flutter run --dart-define=API_BASE_URL=http://192.168.1.42:3000
/// ```
class Env {
  /// Base URL of the VibrantSocial API. Defaults to production so release
  /// builds never accidentally ship pointing at a dev server. Dev runs
  /// override via `--dart-define=API_BASE_URL=...`:
  ///   - iOS simulator:    http://localhost:3000
  ///   - Android emulator: http://10.0.2.2:3000
  ///   - Physical device:  http://<host-lan-ip>:3000
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://vibrantsocial.app',
  );

  /// iOS OAuth 2.0 Client ID from Google Cloud Console. Pass via
  /// `--dart-define=GOOGLE_IOS_CLIENT_ID=xxxxx.apps.googleusercontent.com`.
  /// Also needs to be copied (reversed) into `ios/Runner/Info.plist` as a
  /// URL scheme — see README for the setup checklist.
  static const String googleIosClientId = String.fromEnvironment(
    'GOOGLE_IOS_CLIENT_ID',
  );

  /// Android OAuth 2.0 Client ID (web or android type). Android uses the
  /// google-services.json / package + signing cert; this is here for
  /// completeness.
  static const String googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
  );

  /// True when the platform-appropriate Google config is in place. iOS needs
  /// the iOS client id baked in (Info.plist + this constant); Android uses
  /// the package + SHA-1 registered with Google Cloud plus the web server
  /// client id for ID-token requests.
  static bool googleConfiguredFor({required bool isIos}) {
    return isIos
        ? googleIosClientId.isNotEmpty
        : googleServerClientId.isNotEmpty;
  }
}
