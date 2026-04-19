import 'avatar_frame.dart';

/// Compact user shape used in followers / following / friends lists.
/// Mirrors `src/lib/profile-lists.ts#UserListEntry`.
class UserListEntry {
  UserListEntry({
    required this.id,
    required this.username,
    required this.displayName,
    required this.name,
    required this.avatar,
    required this.tier,
    required this.verified,
    required this.usernameFontFamily,
    required this.frame,
    required this.isFollowing,
    required this.isFriend,
    required this.isSelf,
  });

  final String id;
  final String? username;
  final String? displayName;
  final String? name;
  final String? avatar;
  final String tier;
  final bool verified;
  final String? usernameFontFamily;
  final AvatarFrame? frame;
  final bool isFollowing;
  final bool isFriend;
  final bool isSelf;

  String get displayNameOrUsername =>
      (displayName?.isNotEmpty ?? false)
          ? displayName!
          : (name?.isNotEmpty ?? false)
              ? name!
              : (username ?? 'user');

  factory UserListEntry.fromJson(Map<String, dynamic> json) {
    return UserListEntry(
      id: json['id'] as String,
      username: json['username'] as String?,
      displayName: json['displayName'] as String?,
      name: json['name'] as String?,
      avatar: json['avatar'] as String?,
      tier: json['tier'] as String,
      verified: json['verified'] as bool,
      usernameFontFamily: json['usernameFontFamily'] as String?,
      frame: json['frame'] == null
          ? null
          : AvatarFrame.fromJson(
              (json['frame'] as Map).cast<String, dynamic>(),
            ),
      isFollowing: json['isFollowing'] as bool,
      isFriend: json['isFriend'] as bool,
      isSelf: json['isSelf'] as bool,
    );
  }
}

class UserListPage {
  UserListPage({required this.users, required this.nextCursor});

  final List<UserListEntry> users;
  final String? nextCursor;

  factory UserListPage.fromJson(Map<String, dynamic> json) {
    return UserListPage(
      users: (json['users'] as List)
          .cast<Map>()
          .map((m) => UserListEntry.fromJson(m.cast<String, dynamic>()))
          .toList(),
      nextCursor: json['nextCursor'] as String?,
    );
  }
}
