import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

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
                  child: CachedNetworkImage(
                    imageUrl: frame!.imageUrl,
                    width: overlaySize,
                    height: overlaySize,
                    fit: BoxFit.contain,
                    errorWidget: (_, _, _) => const SizedBox.shrink(),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
