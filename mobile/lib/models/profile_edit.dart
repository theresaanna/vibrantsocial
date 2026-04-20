// Shapes for the edit-profile screen. Kept separate from the read-only
// `ProfileResponse` in `profile.dart` because the edit form carries
// additional fields (notification prefs, visibility toggles, email /
// phone / 2FA status for the "manage on web" links) that never appear
// on the public profile view. NSFW / graphic / sensitive-content prefs
// are intentionally absent — Play policy says those live on the web
// only, and the server route never returns or accepts them.

/// Read shape returned by `GET /api/v1/profile/me`.
class EditableProfile {
  const EditableProfile({
    required this.id,
    required this.username,
    required this.displayName,
    required this.avatar,
    required this.bio,
    required this.tier,
    required this.profileFrameId,
    required this.usernameFont,
    required this.birthdayMonth,
    required this.birthdayDay,
    required this.isProfilePublic,
    required this.hideWallFromFeed,
    required this.pushEnabled,
    required this.emailOnComment,
    required this.emailOnNewChat,
    required this.emailOnMention,
    required this.emailOnFriendRequest,
    required this.emailOnListJoinRequest,
    required this.emailOnSubscribedPost,
    required this.emailOnSubscribedComment,
    required this.emailOnTagPost,
    required this.email,
    required this.emailVerified,
    required this.phoneNumber,
    required this.phoneVerified,
    required this.twoFactorEnabled,
    required this.ageVerified,
    required this.suspended,
  });

  final String id;
  final String? username;
  final String? displayName;
  final String? avatar;
  final String? bio;
  final String tier;
  final String? profileFrameId;
  final String? usernameFont;
  final int? birthdayMonth;
  final int? birthdayDay;
  final bool isProfilePublic;
  final bool hideWallFromFeed;
  final bool pushEnabled;
  final bool emailOnComment;
  final bool emailOnNewChat;
  final bool emailOnMention;
  final bool emailOnFriendRequest;
  final bool emailOnListJoinRequest;
  final bool emailOnSubscribedPost;
  final bool emailOnSubscribedComment;
  final bool emailOnTagPost;

  // Read-only context for "manage on web" rows.
  final String? email;
  final bool emailVerified;
  final String? phoneNumber;
  final bool phoneVerified;
  final bool twoFactorEnabled;
  final bool ageVerified;
  final bool suspended;

  bool get isPremium => tier == "premium";

  factory EditableProfile.fromJson(Map<String, dynamic> json) {
    bool b(String k) => json[k] == true;
    String? s(String k) => json[k] as String?;
    int? i(String k) {
      final v = json[k];
      if (v is int) return v;
      if (v is num) return v.toInt();
      return null;
    }

    return EditableProfile(
      id: json['id'] as String,
      username: s('username'),
      displayName: s('displayName'),
      avatar: s('avatar'),
      bio: s('bio'),
      tier: (s('tier') ?? 'free'),
      profileFrameId: s('profileFrameId'),
      usernameFont: s('usernameFont'),
      birthdayMonth: i('birthdayMonth'),
      birthdayDay: i('birthdayDay'),
      isProfilePublic: b('isProfilePublic'),
      hideWallFromFeed: b('hideWallFromFeed'),
      pushEnabled: b('pushEnabled'),
      emailOnComment: b('emailOnComment'),
      emailOnNewChat: b('emailOnNewChat'),
      emailOnMention: b('emailOnMention'),
      emailOnFriendRequest: b('emailOnFriendRequest'),
      emailOnListJoinRequest: b('emailOnListJoinRequest'),
      emailOnSubscribedPost: b('emailOnSubscribedPost'),
      emailOnSubscribedComment: b('emailOnSubscribedComment'),
      emailOnTagPost: b('emailOnTagPost'),
      email: s('email'),
      emailVerified: b('emailVerified'),
      phoneNumber: s('phoneNumber'),
      phoneVerified: b('phoneVerified'),
      twoFactorEnabled: b('twoFactorEnabled'),
      ageVerified: b('ageVerified'),
      suspended: b('suspended'),
    );
  }
}

/// Partial patch the client sends on save. Only fields the user
/// actually edited are included in the JSON — the server treats
/// missing keys as "leave as-is", so there's no risk of stomping on
/// prefs managed elsewhere.
class ProfileUpdate {
  ProfileUpdate();

  final Map<String, Object?> _fields = {};

  void setString(String key, String? value) => _fields[key] = value;
  void setInt(String key, int? value) => _fields[key] = value;
  void setBool(String key, bool value) => _fields[key] = value;

  bool get isEmpty => _fields.isEmpty;

  Map<String, Object?> toJson() => Map.unmodifiable(_fields);
}
