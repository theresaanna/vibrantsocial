import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/marketplace_api.dart';
import '../models/marketplace.dart';
import '../providers.dart';
import '../widgets/themed_background.dart';

final _marketplaceApiProvider = Provider<MarketplaceApi>(
  (ref) => MarketplaceApi(ref.watch(dioProvider)),
);

final _marketplaceDetailProvider = FutureProvider.autoDispose
    .family<MarketplaceDetail, String>((ref, postId) {
  return ref.watch(_marketplaceApiProvider).fetchDetail(postId);
});

/// Single marketplace listing: hero media, price, seller, description,
/// purchase CTA, Q&A thread. Q&A mutations land in a later phase; for
/// now they render read-only.
class MarketplaceDetailScreen extends ConsumerWidget {
  const MarketplaceDetailScreen({super.key, required this.postId});

  final String postId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(_marketplaceDetailProvider(postId));
    final viewerTheme = ref.watch(viewerThemeProvider);

    return ThemedBackground(
      theme: viewerTheme,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text('Listing'),
          backgroundColor: Colors.transparent,
        ),
        body: detail.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.error_outline, size: 48),
                  const SizedBox(height: 12),
                  Text('Couldn\'t load listing.\n$e',
                      textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () =>
                        ref.invalidate(_marketplaceDetailProvider(postId)),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
          data: (d) => _DetailBody(detail: d),
        ),
      ),
    );
  }
}

class _DetailBody extends StatelessWidget {
  const _DetailBody({required this.detail});

  final MarketplaceDetail detail;

  @override
  Widget build(BuildContext context) {
    final post = detail.post;
    final author = post.author;
    final media = post.primaryMedia;

    return ListView(
      padding: const EdgeInsets.only(bottom: 32),
      children: [
        // Hero image (or fallback tile).
        AspectRatio(
          aspectRatio: 1,
          child: media != null && (media.isImage || media.isYoutube)
              ? CachedNetworkImage(
                  imageUrl: media.displayUrl,
                  fit: BoxFit.cover,
                  placeholder: (_, __) => Container(color: Colors.black12),
                  errorWidget: (_, __, ___) =>
                      const ColoredBox(color: Colors.black12),
                )
              : Container(
                  color: Colors.black12,
                  alignment: Alignment.center,
                  child: const Icon(Icons.shopping_bag_outlined, size: 64),
                ),
        ),

        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(
            children: [
              Text(
                post.priceLabel,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFFD946EF),
                    ),
              ),
              const Spacer(),
              Flexible(
                child: Text(
                  post.details.shippingLabel,
                  style: Theme.of(context).textTheme.bodySmall,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),

        // Seller row
        if (author != null)
          ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16),
            leading: CircleAvatar(
              backgroundImage: author.avatarUrl != null
                  ? CachedNetworkImageProvider(author.avatarUrl!)
                  : null,
              child: author.avatarUrl == null
                  ? const Icon(Icons.person)
                  : null,
            ),
            title: Text(author.displayNameOrUsername),
            subtitle: author.username != null ? Text('@${author.username}') : null,
          ),

        // Description (plain-text slice of the Lexical body).
        if (post.content.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: Text(
              _plainTextFromLexical(post.content),
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),

        // Digital file hint
        if (post.details.digitalFile != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.black12,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(post.details.digitalFile!.isFree
                      ? Icons.download
                      : Icons.lock),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${post.details.digitalFile!.fileName} · '
                      '${post.details.digitalFile!.isFree ? "Free download" : "Paid download"}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ),

        // Purchase CTA
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFD946EF),
              minimumSize: const Size.fromHeight(48),
            ),
            onPressed: () async {
              final uri = Uri.tryParse(post.details.purchaseUrl);
              if (uri != null) {
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              }
            },
            icon: const Icon(Icons.shopping_cart_outlined),
            label: const Text('Buy / more info'),
          ),
        ),

        const SizedBox(height: 24),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text('Questions',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        ),
        const SizedBox(height: 8),

        if (detail.questions.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            child: Text('No questions yet.'),
          )
        else
          for (final q in detail.questions) _QACard(q: q),
      ],
    );
  }
}

class _QACard extends StatelessWidget {
  const _QACard({required this.q});

  final MarketplaceQuestion q;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (q.asker.avatarUrl != null)
                CircleAvatar(
                  radius: 12,
                  backgroundImage:
                      CachedNetworkImageProvider(q.asker.avatarUrl!),
                )
              else
                const CircleAvatar(
                    radius: 12, child: Icon(Icons.person, size: 14)),
              const SizedBox(width: 8),
              Text(q.asker.displayNameOrUsername,
                  style: const TextStyle(fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: 8),
          Text(q.question),
          if (q.answer != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFD946EF).withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Seller reply',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFD946EF),
                      )),
                  const SizedBox(height: 4),
                  Text(q.answer!),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Minimal Lexical-JSON → plain text extractor. Good enough for a
/// marketplace description paragraph; rich formatting (links, mentions)
/// will flow through the shared Lexical renderer once that lands on
/// mobile. Falls back to the raw string if parsing fails.
String _plainTextFromLexical(String raw) {
  if (raw.isEmpty) return '';
  try {
    final parsed = jsonDecode(raw);
    if (parsed is! Map || parsed['root'] is! Map) return raw;
    final buf = StringBuffer();
    void walk(dynamic node) {
      if (node is Map) {
        final type = node['type'];
        if (type == 'text' && node['text'] is String) {
          buf.write(node['text']);
        } else if (type == 'linebreak') {
          buf.write('\n');
        }
        final children = node['children'];
        if (children is List) {
          for (final c in children) {
            walk(c);
          }
          if (type == 'paragraph') buf.write('\n');
        }
      }
    }

    walk(parsed['root']);
    return buf.toString().trim();
  } catch (_) {
    return raw;
  }
}
