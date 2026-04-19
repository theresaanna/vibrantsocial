import 'media.dart';

/// Marketplace-only author slice. Matches the `author` field returned by
/// `/api/v1/marketplace/feed` and `/api/v1/marketplace/:id`.
class MarketplaceAuthor {
  MarketplaceAuthor({
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

  factory MarketplaceAuthor.fromJson(Map<String, dynamic> json) {
    return MarketplaceAuthor(
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

/// Digital-file attachment on a paid listing. When `isFree` is false the
/// backend generates a coupon code, but we don't expose that here — the
/// client uses the purchaseUrl for transactions and the download flow
/// comes over a separate endpoint.
class MarketplaceDigitalFile {
  MarketplaceDigitalFile({
    required this.fileName,
    required this.fileSize,
    required this.isFree,
  });

  final String fileName;
  final int fileSize;
  final bool isFree;

  factory MarketplaceDigitalFile.fromJson(Map<String, dynamic> json) {
    return MarketplaceDigitalFile(
      fileName: json['fileName'] as String,
      fileSize: (json['fileSize'] as num).toInt(),
      isFree: json['isFree'] as bool,
    );
  }
}

/// Pricing / shipping slice of a marketplace listing.
class MarketplaceDetails {
  MarketplaceDetails({
    required this.id,
    required this.price,
    required this.purchaseUrl,
    required this.shippingOption,
    required this.shippingPrice,
    required this.digitalFile,
  });

  final String id;
  final double price;
  final String purchaseUrl;
  /// One of `FREE`, `FLAT_RATE`, `PICKUP_ONLY`, `CONTACT_SELLER`.
  final String shippingOption;
  final double? shippingPrice;
  final MarketplaceDigitalFile? digitalFile;

  /// Human-readable shipping summary.
  String get shippingLabel {
    switch (shippingOption) {
      case 'FREE':
        return 'Free shipping';
      case 'FLAT_RATE':
        return shippingPrice != null
            ? '+ \$${shippingPrice!.toStringAsFixed(2)} shipping'
            : 'Flat rate shipping';
      case 'PICKUP_ONLY':
        return 'Local pickup only';
      case 'CONTACT_SELLER':
      default:
        return 'Contact seller for shipping';
    }
  }

  factory MarketplaceDetails.fromJson(Map<String, dynamic> json) {
    return MarketplaceDetails(
      id: json['id'] as String,
      price: (json['price'] as num).toDouble(),
      purchaseUrl: json['purchaseUrl'] as String,
      shippingOption: json['shippingOption'] as String,
      shippingPrice: (json['shippingPrice'] as num?)?.toDouble(),
      digitalFile: json['digitalFile'] == null
          ? null
          : MarketplaceDigitalFile.fromJson(
              (json['digitalFile'] as Map).cast<String, dynamic>(),
            ),
    );
  }
}

/// A marketplace listing as shown in the grid and on the detail screen.
class MarketplacePost {
  MarketplacePost({
    required this.id,
    required this.slug,
    required this.content,
    required this.createdAt,
    required this.isNsfw,
    required this.isGraphicNudity,
    required this.author,
    required this.details,
    required this.mediaItems,
  });

  final String id;
  final String? slug;
  final String content;
  final DateTime createdAt;
  final bool isNsfw;
  final bool isGraphicNudity;
  final MarketplaceAuthor? author;
  final MarketplaceDetails details;
  final List<MediaItem> mediaItems;

  MediaItem? get primaryMedia =>
      mediaItems.isEmpty ? null : mediaItems.first;

  /// Price formatted for a badge — always USD with 0–2 decimals so
  /// round numbers render tight (`$25`) and change prices don't.
  String get priceLabel {
    final p = details.price;
    final whole = p == p.roundToDouble();
    return whole
        ? '\$${p.toStringAsFixed(0)}'
        : '\$${p.toStringAsFixed(2)}';
  }

  factory MarketplacePost.fromJson(Map<String, dynamic> json) {
    return MarketplacePost(
      id: json['id'] as String,
      slug: json['slug'] as String?,
      content: json['content'] as String? ?? '',
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      isNsfw: json['isNsfw'] as bool? ?? false,
      isGraphicNudity: json['isGraphicNudity'] as bool? ?? false,
      author: json['author'] is Map
          ? MarketplaceAuthor.fromJson(
              (json['author'] as Map).cast<String, dynamic>())
          : null,
      details: MarketplaceDetails.fromJson(
        (json['marketplacePost'] as Map).cast<String, dynamic>(),
      ),
      mediaItems: (json['mediaItems'] as List? ?? const [])
          .map((m) => MediaItem.fromJson((m as Map).cast<String, dynamic>()))
          .toList(),
    );
  }
}

/// One page of marketplace posts + a cursor for the next page.
class MarketplacePage {
  MarketplacePage({
    required this.posts,
    required this.nextCursor,
  });

  final List<MarketplacePost> posts;
  final String? nextCursor;

  factory MarketplacePage.fromJson(Map<String, dynamic> json) {
    return MarketplacePage(
      posts: (json['posts'] as List)
          .map((p) =>
              MarketplacePost.fromJson((p as Map).cast<String, dynamic>()))
          .toList(),
      nextCursor: json['nextCursor'] as String?,
    );
  }
}

/// A Q&A entry on a marketplace listing. Sellers answer asynchronously;
/// `answer` is null and `answeredAt` is null until they respond.
class MarketplaceQuestion {
  MarketplaceQuestion({
    required this.id,
    required this.question,
    required this.answer,
    required this.createdAt,
    required this.answeredAt,
    required this.asker,
  });

  final String id;
  final String question;
  final String? answer;
  final DateTime createdAt;
  final DateTime? answeredAt;
  final MarketplaceAuthor asker;

  factory MarketplaceQuestion.fromJson(Map<String, dynamic> json) {
    return MarketplaceQuestion(
      id: json['id'] as String,
      question: json['question'] as String,
      answer: json['answer'] as String?,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      answeredAt: json['answeredAt'] == null
          ? null
          : DateTime.tryParse(json['answeredAt'] as String),
      asker: MarketplaceAuthor.fromJson(
        (json['asker'] as Map).cast<String, dynamic>(),
      ),
    );
  }
}

/// What `/api/v1/marketplace/:id` returns: the listing itself plus
/// all Q&A attached to it.
class MarketplaceDetail {
  MarketplaceDetail({required this.post, required this.questions});

  final MarketplacePost post;
  final List<MarketplaceQuestion> questions;

  factory MarketplaceDetail.fromJson(Map<String, dynamic> json) {
    return MarketplaceDetail(
      post: MarketplacePost.fromJson(
        (json['post'] as Map).cast<String, dynamic>(),
      ),
      questions: (json['questions'] as List)
          .map((q) =>
              MarketplaceQuestion.fromJson((q as Map).cast<String, dynamic>()))
          .toList(),
    );
  }
}
