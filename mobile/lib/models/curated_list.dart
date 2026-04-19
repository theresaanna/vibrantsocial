/// Flutter-side types for **user-curated lists** — the owner-managed
/// collections of accounts that other users can subscribe to for a
/// filtered feed. Distinct from `UserListEntry` (which backs the
/// followers / following pages).

/// Compact row used on the index screen. Returned by
/// `GET /api/v1/lists` under `owned`, `collaborating`, and `subscribed`.
class CuratedListCard {
  CuratedListCard({
    required this.id,
    required this.name,
    required this.isPrivate,
    required this.memberCount,
    required this.ownerUsername,
  });

  final String id;
  final String name;
  final bool isPrivate;
  final int memberCount;
  final String? ownerUsername;

  factory CuratedListCard.fromJson(Map<String, dynamic> json) {
    return CuratedListCard(
      id: json['id'] as String,
      name: json['name'] as String,
      isPrivate: json['isPrivate'] as bool,
      memberCount: (json['memberCount'] as num).toInt(),
      ownerUsername: json['ownerUsername'] as String?,
    );
  }
}

/// A paginated page of list cards. Returned by `/api/v1/lists/all` for
/// the "Everyone's lists" discovery tab.
class CuratedListPage {
  CuratedListPage({required this.lists, required this.nextCursor});

  final List<CuratedListCard> lists;
  final String? nextCursor;

  factory CuratedListPage.fromJson(Map<String, dynamic> json) {
    return CuratedListPage(
      lists: (json['lists'] as List)
          .map((c) =>
              CuratedListCard.fromJson((c as Map).cast<String, dynamic>()))
          .toList(),
      nextCursor: json['nextCursor'] as String?,
    );
  }
}

/// The three sections of the index screen.
class CuratedListOverview {
  CuratedListOverview({
    required this.owned,
    required this.collaborating,
    required this.subscribed,
  });

  final List<CuratedListCard> owned;
  final List<CuratedListCard> collaborating;
  final List<CuratedListCard> subscribed;

  factory CuratedListOverview.fromJson(Map<String, dynamic> json) {
    List<CuratedListCard> parse(String key) =>
        (json[key] as List)
            .map((c) => CuratedListCard.fromJson((c as Map).cast<String, dynamic>()))
            .toList();
    return CuratedListOverview(
      owned: parse('owned'),
      collaborating: parse('collaborating'),
      subscribed: parse('subscribed'),
    );
  }
}

/// User shown under a list's "Members" section (or as the list's owner).
/// Matches the author slice returned by the web.
class CuratedListPerson {
  CuratedListPerson({
    required this.id,
    required this.username,
    required this.displayName,
    required this.name,
    required this.avatar,
    required this.image,
    required this.profileFrameId,
  });

  final String id;
  final String? username;
  final String? displayName;
  final String? name;
  final String? avatar;
  final String? image;
  final String? profileFrameId;

  String get displayNameOrUsername =>
      (displayName?.isNotEmpty ?? false)
          ? displayName!
          : (name?.isNotEmpty ?? false)
              ? name!
              : (username ?? 'user');

  String? get avatarUrl =>
      (avatar?.isNotEmpty ?? false) ? avatar : image;

  factory CuratedListPerson.fromJson(Map<String, dynamic> json) {
    return CuratedListPerson(
      id: json['id'] as String,
      username: json['username'] as String?,
      displayName: json['displayName'] as String?,
      name: json['name'] as String?,
      avatar: json['avatar'] as String?,
      image: json['image'] as String?,
      profileFrameId: json['profileFrameId'] as String?,
    );
  }
}

class CuratedListMember {
  CuratedListMember({required this.addedAt, required this.user});

  final DateTime addedAt;
  final CuratedListPerson user;

  factory CuratedListMember.fromJson(Map<String, dynamic> json) {
    return CuratedListMember(
      addedAt: DateTime.tryParse(json['addedAt'] as String? ?? '') ??
          DateTime.now(),
      user: CuratedListPerson.fromJson(
        (json['user'] as Map).cast<String, dynamic>(),
      ),
    );
  }
}

/// Viewer-relative permission flags — drives which controls render
/// on the detail screen.
class CuratedListRole {
  CuratedListRole({
    required this.isOwner,
    required this.isCollaborator,
    required this.isMember,
    required this.isSubscribed,
  });

  final bool isOwner;
  final bool isCollaborator;
  final bool isMember;
  final bool isSubscribed;

  /// True when the viewer has any management privilege (owner or
  /// collaborator) — gates member add/remove UI.
  bool get canManage => isOwner || isCollaborator;

  factory CuratedListRole.fromJson(Map<String, dynamic> json) {
    return CuratedListRole(
      isOwner: json['isOwner'] as bool,
      isCollaborator: json['isCollaborator'] as bool,
      isMember: json['isMember'] as bool,
      isSubscribed: json['isSubscribed'] as bool,
    );
  }
}

/// Full detail payload returned by `GET /api/v1/lists/:id`.
class CuratedListDetail {
  CuratedListDetail({
    required this.id,
    required this.name,
    required this.isPrivate,
    required this.createdAt,
    required this.owner,
    required this.members,
    required this.role,
  });

  final String id;
  final String name;
  final bool isPrivate;
  final DateTime createdAt;
  final CuratedListPerson owner;
  final List<CuratedListMember> members;
  final CuratedListRole role;

  factory CuratedListDetail.fromJson(Map<String, dynamic> json) {
    final list = (json['list'] as Map).cast<String, dynamic>();
    return CuratedListDetail(
      id: list['id'] as String,
      name: list['name'] as String,
      isPrivate: list['isPrivate'] as bool,
      createdAt: DateTime.tryParse(list['createdAt'] as String? ?? '') ??
          DateTime.now(),
      owner: CuratedListPerson.fromJson(
        (list['owner'] as Map).cast<String, dynamic>(),
      ),
      members: (json['members'] as List)
          .map((m) => CuratedListMember.fromJson(
              (m as Map).cast<String, dynamic>()))
          .toList(),
      role: CuratedListRole.fromJson(
        (json['role'] as Map).cast<String, dynamic>(),
      ),
    );
  }
}
