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
  ///   - Physical device:  http://HOST-LAN-IP:3000
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://vibrantsocial.app',
  );

  /// iOS OAuth 2.0 Client ID from Google Cloud Console. The default
  /// matches the `GIDClientID` already baked into `ios/Runner/Info.plist`
  /// (same value, same reversed URL scheme). Override via
  /// `--dart-define=GOOGLE_IOS_CLIENT_ID=...` when targeting a different
  /// Google Cloud project.
  static const String googleIosClientId = String.fromEnvironment(
    'GOOGLE_IOS_CLIENT_ID',
    defaultValue: '380367672536-5fqsmlq8tea0er8km7bfs9qrj7f9mgi7.apps.googleusercontent.com',
  );

  /// Web OAuth 2.0 Client ID. Android passes this as `serverClientId` to
  /// the Google Sign-In SDK so the server can verify the returned ID
  /// token's `aud` against `AUTH_GOOGLE_ID` (see
  /// `src/app/api/v1/auth/oauth/native/route.ts`). Safe to ship hard-
  /// coded — it's a public identifier, not a secret.
  static const String googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue: '902385808349-uaghc2j79qkaanba60fveglfj0l7hh4i.apps.googleusercontent.com',
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
