import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../models/avatar_frame.dart';

/// Circle avatar with an optional decorative frame overlay driven by the
/// server-issued [AvatarFrame] metadata. Used wherever we paint a user's
/// face — profile header, post card, comment, list rows — so the frame
/// matches the web app's styling everywhere.
class FramedAvatar extends StatelessWidget {
  const FramedAvatar({
    super.key,
    required this.avatarUrl,
    required this.frame,
    required this.size,
    this.borderColor,
    this.placeholderIconColor,
  });

  final String? avatarUrl;
  final AvatarFrame? frame;
  final double size;
  final Color? borderColor;
  final Color? placeholderIconColor;

  @override
  Widget build(BuildContext context) {
    final overlaySize = size * 1.3;
    final placeholderColor = placeholderIconColor ?? Colors.white;
    return SizedBox(
      width: overlaySize,
      height: overlaySize,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: borderColor ?? Theme.of(context).colorScheme.surfaceContainerHighest,
              border: frame == null
                  ? null
                  : const Border.fromBorderSide(
                      BorderSide(color: Colors.white, width: 2),
                    ),
              image: avatarUrl == null
                  ? null
                  : DecorationImage(
                      image: CachedNetworkImageProvider(avatarUrl!),
                      fit: BoxFit.cover,
                    ),
            ),
            child: avatarUrl == null
                ? Icon(Icons.person, size: size * 0.55, color: placeholderColor)
                : null,
          ),
          if (frame != null)
            IgnorePointer(
              child: Transform.scale(
                scaleX: frame!.scaleX * frame!.frameScale,
                scaleY: frame!.scaleY * frame!.frameScale,
                child: Transform.translate(
                  offset: Offset(frame!.offsetX, frame!.offsetY),
                  child: _frameImage(frame!.imageUrl, overlaySize),
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// Decode SVG and raster frames separately — `CachedNetworkImage` only
  /// handles raster, but our frame catalog mixes PNG (whimsy/floral) and
  /// SVG (spring/neon/decorative). Without this branch, SVG frames
  /// silently fail their error widget and never render.
  Widget _frameImage(String url, double overlaySize) {
    final lower = url.toLowerCase();
    final isSvg = lower.endsWith('.svg') ||
        lower.contains('.svg?');
    if (isSvg) {
      return SvgPicture.network(
        url,
        width: overlaySize,
        height: overlaySize,
        fit: BoxFit.contain,
        placeholderBuilder: (_) => const SizedBox.shrink(),
      );
    }
    return CachedNetworkImage(
      imageUrl: url,
      width: overlaySize,
      height: overlaySize,
      fit: BoxFit.contain,
      errorWidget: (_, _, _) => const SizedBox.shrink(),
    );
  }
}
