/// OpenGraph metadata for a URL, fetched server-side and cached.
/// Mirrors `LinkPreviewData` in `src/app/feed/link-preview-action.ts`.
class LinkPreviewData {
  LinkPreviewData({
    required this.url,
    required this.title,
    required this.description,
    required this.image,
    required this.siteName,
    required this.favicon,
  });

  final String url;
  final String? title;
  final String? description;
  final String? image;
  final String? siteName;
  final String? favicon;

  factory LinkPreviewData.fromJson(Map<String, dynamic> json) {
    return LinkPreviewData(
      url: json['url'] as String,
      title: json['title'] as String?,
      description: json['description'] as String?,
      image: json['image'] as String?,
      siteName: json['siteName'] as String?,
      favicon: json['favicon'] as String?,
    );
  }

  bool get isEmpty =>
      (title == null || title!.isEmpty) &&
      (description == null || description!.isEmpty) &&
      (image == null || image!.isEmpty);
}
