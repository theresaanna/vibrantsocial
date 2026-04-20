// Read + write shapes for the mobile links-page editor — the in-app
// version of the web's `/profile/links`. The public page lives at
// links.vibrantsocial.app/{username}.

/// Single row in the viewer's links list.
class LinksPageEntry {
  const LinksPageEntry({
    this.id,
    required this.title,
    required this.url,
  });

  /// Server id — null for rows the user just added and hasn't saved
  /// yet. The server takes `{title, url}[]` on save and re-emits ids.
  final String? id;
  final String title;
  final String url;

  factory LinksPageEntry.fromJson(Map<String, dynamic> json) {
    return LinksPageEntry(
      id: json['id'] as String?,
      title: (json['title'] as String?) ?? '',
      url: (json['url'] as String?) ?? '',
    );
  }

  LinksPageEntry copyWith({String? title, String? url}) => LinksPageEntry(
        id: id,
        title: title ?? this.title,
        url: url ?? this.url,
      );
}

/// Full read payload from `GET /api/v1/profile/links`.
class LinksPageConfig {
  const LinksPageConfig({
    required this.enabled,
    required this.bio,
    required this.entries,
  });

  final bool enabled;
  final String? bio;
  final List<LinksPageEntry> entries;

  factory LinksPageConfig.fromJson(Map<String, dynamic> json) {
    final rawLinks = (json['links'] as List?) ?? const [];
    return LinksPageConfig(
      enabled: json['enabled'] == true,
      bio: json['bio'] as String?,
      entries: rawLinks
          .map((e) => LinksPageEntry.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
    );
  }
}
