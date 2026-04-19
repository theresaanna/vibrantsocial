import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../providers.dart';

/// Compact OG-preview card for the first URL in a chat message.
/// Returns shrink-wrapped empty space while loading or when there's no
/// metadata, so it never adds noise to the bubble.
class LinkPreviewCard extends ConsumerWidget {
  const LinkPreviewCard({
    super.key,
    required this.url,
    required this.textColor,
    required this.borderColor,
  });

  final String url;
  final Color textColor;
  final Color borderColor;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preview = ref.watch(linkPreviewProvider(url));
    return preview.maybeWhen(
      data: (data) {
        if (data == null || data.isEmpty) return const SizedBox.shrink();
        final image = data.image;
        final title = data.title ?? data.url;
        final description = data.description;
        final siteName = data.siteName ?? Uri.tryParse(data.url)?.host;
        return Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Material(
            color: Colors.transparent,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
              side: BorderSide(color: borderColor.withValues(alpha: 0.4)),
            ),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () async {
                final uri = Uri.tryParse(data.url);
                if (uri != null) {
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                }
              },
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (image != null && image.isNotEmpty)
                    CachedNetworkImage(
                      imageUrl: image,
                      height: 120,
                      fit: BoxFit.cover,
                      errorWidget: (_, _, _) => const SizedBox.shrink(),
                    ),
                  Padding(
                    padding: const EdgeInsets.all(10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (siteName != null && siteName.isNotEmpty)
                          Text(
                            siteName,
                            style: TextStyle(
                              fontSize: 11,
                              color: textColor.withValues(alpha: 0.7),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        Text(
                          title,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: textColor,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (description != null && description.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              description,
                              style: TextStyle(
                                fontSize: 12,
                                color: textColor.withValues(alpha: 0.8),
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
      orElse: () => const SizedBox.shrink(),
    );
  }
}
