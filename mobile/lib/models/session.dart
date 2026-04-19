/// Authenticated user shape returned alongside a JWT from the auth API.
///
/// Mirrors the subset of fields the server bakes into the mobile JWT payload
/// (see `src/lib/mobile-auth.ts#MobileTokenPayload`). We keep this narrow on
/// purpose — the full profile comes from `/api/v1/profile/...` once that
/// slice lands.
class MobileUser {
  MobileUser({
    required this.id,
    required this.email,
    required this.username,
    required this.displayName,
    required this.avatar,
    required this.tier,
  });

  final String id;
  final String email;
  final String? username;
  final String? displayName;
  final String? avatar;
  final String tier;

  factory MobileUser.fromJson(Map<String, dynamic> json) {
    return MobileUser(
      id: json['id'] as String,
      email: json['email'] as String,
      username: json['username'] as String?,
      displayName: json['displayName'] as String?,
      avatar: json['avatar'] as String?,
      tier: (json['tier'] as String?) ?? 'free',
    );
  }
}

/// A bound (token + user) pair. Represents the user's authenticated state.
class Session {
  Session({required this.token, required this.user});

  final String token;
  final MobileUser user;
}
