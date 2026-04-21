import 'dart:async';
import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

/// Product ID for the monthly premium subscription. Must match the SKU
/// you configure in Google Play Console (and later the App Store
/// Connect product id). Keep it here so the server endpoint
/// `POST /api/iap/google` receives a value the validator recognizes.
const kPremiumMonthlyProductId = 'premium_monthly';

/// Outcome of a subscribe / restore attempt. The UI maps these to
/// snackbars / success screens rather than raw exceptions.
enum IapOutcome {
  /// Purchase completed end-to-end (Google approved + server activated).
  success,

  /// User dismissed the Play sheet mid-flow. Non-error; no toast needed.
  cancelled,

  /// Play-level error (network, declined card, etc.).
  playError,

  /// Google approved, but the server rejected the receipt. Rare —
  /// usually a Play Console misconfiguration (wrong product id /
  /// service account).
  serverRejected,

  /// In-app billing isn't available on this device at all (emulator
  /// without Play Services, a non-Google device, or the user has Play
  /// disabled).
  unavailable,

  /// Restore finished but no active subscription was found to restore.
  noPurchaseToRestore,
}

class IapResult {
  const IapResult(this.outcome, {this.message});
  final IapOutcome outcome;
  final String? message;
}

/// Wraps `in_app_purchase` for the premium subscription flow. One
/// long-lived instance per app; the `purchaseStream` subscription is
/// opened on first use and closed when the app disposes.
class IapService {
  IapService(this._dio);

  final Dio _dio;
  final InAppPurchase _iap = InAppPurchase.instance;
  StreamSubscription<List<PurchaseDetails>>? _sub;
  ProductDetails? _cachedProduct;

  /// The single outstanding "complete this purchase" future. Flutter's
  /// purchase API is event-stream based (a new purchase lands on the
  /// stream at some later point), so we bridge it to a regular
  /// `Future<IapResult>` here.
  Completer<IapResult>? _pendingResult;

  /// True when we can show a Subscribe button. False on devices without
  /// Play Services (desktop emulator snapshot, some Huawei devices).
  Future<bool> isAvailable() => _iap.isAvailable();

  /// Fetch the localized product metadata (price, currency, title).
  /// Returns null when the product isn't published yet in Play Console
  /// or the Android build is using a different `applicationId`.
  Future<ProductDetails?> fetchProduct() async {
    if (_cachedProduct != null) return _cachedProduct;
    if (!await _iap.isAvailable()) return null;
    final response = await _iap.queryProductDetails({kPremiumMonthlyProductId});
    if (response.notFoundIDs.isNotEmpty || response.productDetails.isEmpty) {
      return null;
    }
    _cachedProduct = response.productDetails.first;
    return _cachedProduct;
  }

  /// Launch the Play subscription purchase flow and resolve when the
  /// result arrives (success / cancel / error). The returned future
  /// waits on the purchase stream.
  Future<IapResult> subscribe() async {
    if (!Platform.isAndroid) {
      return const IapResult(
        IapOutcome.unavailable,
        message: 'Google Play Billing is Android-only.',
      );
    }
    if (!await _iap.isAvailable()) {
      return const IapResult(
        IapOutcome.unavailable,
        message: 'Google Play Billing is not available on this device.',
      );
    }
    final product = await fetchProduct();
    if (product == null) {
      return const IapResult(
        IapOutcome.unavailable,
        message: 'Premium is not configured for this build yet.',
      );
    }

    _ensureListening();

    // Refuse to start a second purchase while one is in flight — Play
    // won't let us anyway; this gives a cleaner error message.
    if (_pendingResult != null && !_pendingResult!.isCompleted) {
      return const IapResult(
        IapOutcome.playError,
        message: 'A purchase is already in progress.',
      );
    }
    _pendingResult = Completer<IapResult>();

    final param = PurchaseParam(productDetails: product);
    try {
      final launched = await _iap.buyNonConsumable(purchaseParam: param);
      if (!launched) {
        _pendingResult?.complete(const IapResult(
          IapOutcome.playError,
          message: 'Google Play refused to start the purchase.',
        ));
      }
    } catch (e) {
      _pendingResult?.complete(IapResult(
        IapOutcome.playError,
        message: 'Purchase failed: $e',
      ));
    }
    return _pendingResult!.future;
  }

  /// Ask Play for any previously-paid entitlements. If one comes back
  /// on the stream we hand it off to the server, same as a fresh
  /// purchase.
  Future<IapResult> restore() async {
    if (!Platform.isAndroid) {
      return const IapResult(IapOutcome.unavailable);
    }
    if (!await _iap.isAvailable()) {
      return const IapResult(IapOutcome.unavailable);
    }
    _ensureListening();
    _pendingResult = Completer<IapResult>();

    // `restorePurchases` fires PurchaseStatus.restored onto the same
    // stream we already listen on — from the UI's perspective a restore
    // looks identical to a fresh purchase once the server accepts it.
    await _iap.restorePurchases();

    // Play's restore stream doesn't explicitly signal "no purchases to
    // restore"; give it a short window before giving up.
    return _pendingResult!.future.timeout(
      const Duration(seconds: 4),
      onTimeout: () {
        if (_pendingResult != null && !_pendingResult!.isCompleted) {
          _pendingResult!.complete(const IapResult(
            IapOutcome.noPurchaseToRestore,
            message: 'No active premium subscription found for this account.',
          ));
        }
        return _pendingResult!.future;
      },
    );
  }

  void _ensureListening() {
    _sub ??= _iap.purchaseStream.listen(_onPurchaseUpdates);
  }

  Future<void> _onPurchaseUpdates(List<PurchaseDetails> updates) async {
    for (final p in updates) {
      if (p.status == PurchaseStatus.pending) {
        // User is mid-flow; nothing to do yet.
        continue;
      }
      if (p.status == PurchaseStatus.canceled) {
        _resolve(const IapResult(IapOutcome.cancelled));
        if (p.pendingCompletePurchase) {
          await _iap.completePurchase(p);
        }
        continue;
      }
      if (p.status == PurchaseStatus.error) {
        _resolve(IapResult(
          IapOutcome.playError,
          message: p.error?.message ?? 'Purchase failed.',
        ));
        if (p.pendingCompletePurchase) {
          await _iap.completePurchase(p);
        }
        continue;
      }
      if (p.status == PurchaseStatus.purchased ||
          p.status == PurchaseStatus.restored) {
        final serverResult = await _verifyWithServer(p);
        _resolve(serverResult);
        // Regardless of whether the server accepted, let Play know we
        // "finished" the purchase so the token isn't re-delivered on
        // every app start. If the server rejected we've already
        // surfaced that to the user.
        if (p.pendingCompletePurchase) {
          await _iap.completePurchase(p);
        }
      }
    }
  }

  Future<IapResult> _verifyWithServer(PurchaseDetails p) async {
    // On Android, `serverVerificationData` is the Play purchase token
    // — that's the exact value the Play Developer API validator on
    // the server expects. On iOS this same field carries the App
    // Store receipt, which we don't verify in this build yet.
    final token = p.verificationData.serverVerificationData;
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/iap/google',
        data: {
          'purchaseToken': token,
          'productId': p.productID,
        },
      );
      final data = res.data ?? const {};
      if (data['success'] == true) {
        return const IapResult(IapOutcome.success);
      }
      return IapResult(
        IapOutcome.serverRejected,
        message: (data['message'] as String?) ?? 'Server rejected the receipt.',
      );
    } on DioException catch (e) {
      final data = e.response?.data;
      final msg = data is Map && data['message'] is String
          ? data['message'] as String
          : 'Could not verify purchase with server.';
      return IapResult(IapOutcome.serverRejected, message: msg);
    }
  }

  void _resolve(IapResult result) {
    final c = _pendingResult;
    if (c != null && !c.isCompleted) {
      c.complete(result);
    }
  }

  Future<void> dispose() async {
    await _sub?.cancel();
    _sub = null;
  }
}
