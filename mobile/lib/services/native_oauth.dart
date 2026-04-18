import 'dart:io' show Platform;

import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../api/auth_api.dart';
import '../config/env.dart';

/// Signals that a sign-in attempt was cancelled by the user — not an error.
class OAuthCancelled implements Exception {
  const OAuthCancelled();
}

/// Signals the app is missing OAuth config (client ID, entitlement, etc).
class OAuthNotConfigured implements Exception {
  OAuthNotConfigured(this.message);
  final String message;
  @override
  String toString() => message;
}

/// Result of a successful native sign-in — hand the idToken (and Apple-only
/// extras on first auth) to `AuthApi.oauthNative`.
class NativeOAuthResult {
  NativeOAuthResult({
    required this.provider,
    required this.idToken,
    this.apple,
  });
  final String provider;
  final String idToken;
  final AppleExtras? apple;
}

class NativeOAuth {
  /// Kick off Google Sign-In via the native SDK. Returns the Google-issued
  /// ID token; the server verifies it against Google's JWKS.
  Future<NativeOAuthResult> google() async {
    if (!Env.googleConfiguredFor(isIos: Platform.isIOS)) {
      throw OAuthNotConfigured(
        Platform.isIOS
            ? 'Google Sign-In is not configured. Pass '
                '--dart-define=GOOGLE_IOS_CLIENT_ID=... when running on iOS.'
            : 'Google Sign-In is not configured. Pass '
                '--dart-define=GOOGLE_SERVER_CLIENT_ID=... (your web OAuth '
                'client id) when running on Android.',
      );
    }
    final signIn = GoogleSignIn(
      clientId: Platform.isIOS ? Env.googleIosClientId : null,
      serverClientId: Env.googleServerClientId.isNotEmpty
          ? Env.googleServerClientId
          : null,
      scopes: const ['email', 'profile'],
    );
    final account = await signIn.signIn();
    if (account == null) {
      throw const OAuthCancelled();
    }
    final auth = await account.authentication;
    final idToken = auth.idToken;
    if (idToken == null || idToken.isEmpty) {
      throw OAuthNotConfigured(
        'Google did not return an ID token. Check that the iOS OAuth '
        'client ID matches the one in Google Cloud Console.',
      );
    }
    return NativeOAuthResult(provider: 'google', idToken: idToken);
  }

  /// Kick off Sign in with Apple. Only works on iOS 13+ / macOS 10.15+ (and
  /// web-based flow on Android); we surface a not-configured error on
  /// anything else.
  Future<NativeOAuthResult> apple() async {
    if (!Platform.isIOS && !Platform.isMacOS) {
      throw OAuthNotConfigured(
        'Sign in with Apple on Android / web requires extra setup — not '
        'enabled yet.',
      );
    }
    try {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: const [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );
      final idToken = credential.identityToken;
      if (idToken == null || idToken.isEmpty) {
        throw OAuthNotConfigured(
          'Apple did not return an identity token.',
        );
      }
      return NativeOAuthResult(
        provider: 'apple',
        idToken: idToken,
        apple: AppleExtras(
          givenName: credential.givenName,
          familyName: credential.familyName,
          email: credential.email,
        ),
      );
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) {
        throw const OAuthCancelled();
      }
      rethrow;
    }
  }
}
