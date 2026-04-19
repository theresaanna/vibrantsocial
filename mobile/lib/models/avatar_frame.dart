/// Mirrors `SerializedAvatarFrame` from `src/lib/profile-lists.ts`.
/// The minimal metadata needed to overlay a user's chosen frame on their
/// avatar — same shape regardless of whether the user shows up in a
/// list, a post card, or a comment.
class AvatarFrame {
  const AvatarFrame({
    required this.id,
    required this.imageUrl,
    required this.scaleX,
    required this.scaleY,
    required this.offsetX,
    required this.offsetY,
    required this.frameScale,
  });

  final String id;
  final String imageUrl;
  final double scaleX;
  final double scaleY;
  final double offsetX;
  final double offsetY;
  final double frameScale;

  factory AvatarFrame.fromJson(Map<String, dynamic> json) {
    return AvatarFrame(
      id: json['id'] as String,
      imageUrl: json['imageUrl'] as String,
      scaleX: (json['scaleX'] as num).toDouble(),
      scaleY: (json['scaleY'] as num).toDouble(),
      offsetX: (json['offsetX'] as num).toDouble(),
      offsetY: (json['offsetY'] as num).toDouble(),
      frameScale: (json['frameScale'] as num).toDouble(),
    );
  }
}

/// Convert a `ResolvedFrame` (from `ResolvedTheme`) into the shared
/// `AvatarFrame` used by [FramedAvatar]. Both shapes carry the same
/// geometry data — this adapter just trims the theme-specific extras.
AvatarFrame avatarFrameFromTheme(dynamic themeFrame) {
  return AvatarFrame(
    id: themeFrame.id as String,
    imageUrl: themeFrame.imageUrl as String,
    scaleX: themeFrame.scaleX as double,
    scaleY: themeFrame.scaleY as double,
    offsetX: themeFrame.offsetX as double,
    offsetY: themeFrame.offsetY as double,
    frameScale: themeFrame.frameScale as double,
  );
}
