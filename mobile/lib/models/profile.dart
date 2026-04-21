import 'block.dart';
import 'resolved_theme.dart';

/// Mirrors `GET /api/v1/profile/:username`. Keep the shape aligned with
/// `src/app/api/v1/profile/[username]/route.ts` — both sides should break
/// the `version` field before changing semantics.
class ProfileResponse {
  ProfileResponse({
    required this.version,
    required this.user,
    required this.theme,
    required this.counts,
    required this.relationship,
  });

  final int version;
  final ProfileUser user;
  final ResolvedTheme theme;
  final ProfileCounts counts;
  final ProfileRelationship relationship;

  factory ProfileResponse.fromJson(Map<String, dynamic> json) {
    return ProfileResponse(
      version: json['version'] as int,
      user: ProfileUser.fromJson((json['user'] as Map).cast<String, dynamic>()),
      theme: ResolvedTheme.fromJson(
        (json['theme'] as Map).cast<String, dynamic>(),
      ),
      counts: ProfileCounts.fromJson(
        (json['counts'] as Map).cast<String, dynamic>(),
      ),
      relationship: ProfileRelationship.fromJson(
        (json['relationship'] as Map).cast<String, dynamic>(),
      ),
    );
  }
}

/// One run of text from the user's Lexical bio. When [url] is set, the
/// entire [text] should render as a link; callers are expected to chain
/// consecutive segments into a single paragraph.
class BioSegment {
  BioSegment({required this.text, this.url});

  final String text;
  final String? url;

  factory BioSegment.fromJson(Map<String, dynamic> json) {
    return BioSegment(
      text: json['text'] as String,
      url: json['url'] as String?,
    );
  }
}

class ProfileUser {
  ProfileUser({
    required this.id,
    required this.username,
    required this.displayName,
    required this.name,
    required this.avatar,
    required this.bio,
    required this.bioPlain,
    required this.bioSegments,
    required this.bioBlocks,
    required this.tier,
    required this.verified,
    required this.createdAt,
    required this.hideWallFromFeed,
  });

  final String id;
  final String? username;
  final String? displayName;
  final String? name;
  final String? avatar;

  /// Raw Lexical JSON blob. Kept for full fidelity when we ship a richer
  /// renderer; the lightweight client path should render [bioSegments].
  final String? bio;

  /// Flat plain-text extraction (whitespace-normalized). Use for previews.
  final String? bioPlain;

  /// Ordered list of text/link segments — render as a paragraph, making
  /// spans with a non-null `url` tappable.
  final List<BioSegment> bioSegments;

  /// Full structured blocks for the bio — mirrors the `Block[]` wire
  /// format used by posts, so the same renderer handles inline images,
  /// YouTube previews, lists, headings, etc.
  final List<Block> bioBlocks;

  final String tier;
  final bool verified;
  final DateTime createdAt;

  /// When `true`, wall posts live in their own dedicated screen
  /// instead of being interleaved into the profile's Posts tab.
  /// Mirrors the web flag of the same name.
  final bool hideWallFromFeed;

  String get displayNameOrUsername =>
      (displayName?.isNotEmpty ?? false)
          ? displayName!
          : (name?.isNotEmpty ?? false)
              ? name!
              : (username ?? 'user');

  factory ProfileUser.fromJson(Map<String, dynamic> json) {
    return ProfileUser(
      id: json['id'] as String,
      username: json['username'] as String?,
      displayName: json['displayName'] as String?,
      name: json['name'] as String?,
      avatar: json['avatar'] as String?,
      bio: json['bio'] as String?,
      bioPlain: json['bioPlain'] as String?,
      bioSegments: (json['bioSegments'] as List? ?? const [])
          .cast<Map>()
          .map((m) => BioSegment.fromJson(m.cast<String, dynamic>()))
          .toList(),
      bioBlocks: (json['bioBlocks'] as List? ?? const [])
          .cast<Map>()
          .map((m) => Block.fromJson(m.cast<String, dynamic>()))
          .toList(),
      tier: json['tier'] as String,
      verified: json['verified'] as bool,
      createdAt: DateTime.parse(json['createdAt'] as String),
      hideWallFromFeed: json['hideWallFromFeed'] as bool? ?? false,
    );
  }
}

class ProfileCounts {
  ProfileCounts({
    required this.followers,
    required this.following,
    required this.friends,
    required this.posts,
    required this.statuses,
  });

  final int followers;
  final int following;
  final int friends;
  final int posts;
  final int statuses;

  factory ProfileCounts.fromJson(Map<String, dynamic> json) {
    return ProfileCounts(
      followers: json['followers'] as int,
      following: json['following'] as int,
      friends: json['friends'] as int,
      posts: json['posts'] as int,
      statuses: json['statuses'] as int,
    );
  }
}

class ProfileRelationship {
  ProfileRelationship({
    required this.isSelf,
    required this.isFollowing,
    required this.followsMe,
    required this.isFriend,
    required this.friendRequestOutgoing,
    required this.friendRequestIncoming,
    required this.blockedByMe,
    required this.canMessage,
  });

  final bool isSelf;
  final bool isFollowing;
  final bool followsMe;
  final bool isFriend;
  final bool friendRequestOutgoing;
  final bool friendRequestIncoming;
  final bool blockedByMe;
  final bool canMessage;

  factory ProfileRelationship.fromJson(Map<String, dynamic> json) {
    return ProfileRelationship(
      isSelf: json['isSelf'] as bool,
      isFollowing: json['isFollowing'] as bool,
      followsMe: json['followsMe'] as bool,
      isFriend: json['isFriend'] as bool,
      friendRequestOutgoing: json['friendRequestOutgoing'] as bool,
      friendRequestIncoming: json['friendRequestIncoming'] as bool,
      blockedByMe: json['blockedByMe'] as bool,
      canMessage: json['canMessage'] as bool,
    );
  }
}

