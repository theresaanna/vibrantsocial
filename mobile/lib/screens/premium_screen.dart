import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import '../providers.dart';
import '../services/iap_service.dart';
import '../widgets/auth_card.dart';

/// Landing page for the $4.99/mo premium subscription. Reached from
/// every premium-gated control in the app: avatar frames, theme
/// colors, premium fonts, premium backgrounds, sparklefall.
///
/// The Subscribe CTA routes through `IapService` which launches Google
/// Play Billing, acknowledges with Google, and posts the purchase
/// token to `/api/iap/google` for server-side validation + activation.
class PremiumScreen extends ConsumerStatefulWidget {
  const PremiumScreen({super.key});

  @override
  ConsumerState<PremiumScreen> createState() => _PremiumScreenState();
}

class _PremiumScreenState extends ConsumerState<PremiumScreen> {
  bool _busy = false;
  String? _status;
  Future<ProductDetails?>? _productLoad;

  @override
  void initState() {
    super.initState();
    _productLoad = ref.read(iapServiceProvider).fetchProduct();
  }

  Future<void> _subscribe() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _status = null;
    });
    final result = await ref.read(iapServiceProvider).subscribe();
    if (!mounted) return;
    _handleResult(result, successVerb: 'Activated');
  }

  Future<void> _restore() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _status = null;
    });
    final result = await ref.read(iapServiceProvider).restore();
    if (!mounted) return;
    _handleResult(result, successVerb: 'Restored');
  }

  void _handleResult(IapResult result, {required String successVerb}) {
    setState(() => _busy = false);
    switch (result.outcome) {
      case IapOutcome.success:
        // Flush any cached "profile.tier = free" by popping back — the
        // caller (edit profile / theme editor) refetches on return.
        Navigator.of(context).pop(true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$successVerb — you\'re premium now. ✨')),
        );
        break;
      case IapOutcome.cancelled:
        // User dismissed. No message — the sheet already shows "Cancelled".
        break;
      case IapOutcome.noPurchaseToRestore:
        setState(() => _status =
            result.message ?? 'No active premium subscription found.');
        break;
      case IapOutcome.unavailable:
      case IapOutcome.playError:
      case IapOutcome.serverRejected:
        setState(() =>
            _status = result.message ?? 'Something went wrong. Try again.');
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthCard(
      leading: IconButton(
        tooltip: 'Back',
        onPressed: () => Navigator.of(context).pop(),
        icon: const Icon(Icons.arrow_back),
      ),
      children: [
        const BrandedAuthHeader(
          lead: 'Go premium on ',
          subtitle: 'Unlock every look on your profile.',
        ),
        const SizedBox(height: 24),
        const _FeatureList(),
        const SizedBox(height: 20),
        _PriceRow(productFuture: _productLoad),
        const SizedBox(height: 16),
        AuthGradientButton(
          onTap: _busy ? null : _subscribe,
          busy: _busy,
          label: 'Subscribe',
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: _busy ? null : _restore,
          child: const Text('Restore purchases'),
        ),
        if (_status != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              _status!,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: Theme.of(context).colorScheme.error,
              ),
            ),
          ),
        const SizedBox(height: 16),
        Text(
          "Billed monthly by Google Play. Cancel anytime from your Play "
          'subscriptions. Renews automatically until canceled.',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 11,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

/// Five-row perk list. Ordering mirrors the visual surfaces most
/// people see first (avatar → theme → fonts → sparklefall).
class _FeatureList extends StatelessWidget {
  const _FeatureList();

  @override
  Widget build(BuildContext context) {
    const perks = <(IconData, String, String)>[
      (
        Icons.auto_awesome_outlined,
        'Avatar frames',
        'Animated + seasonal frames around your profile photo.',
      ),
      (
        Icons.palette_outlined,
        'Custom theme colors',
        'Full control over background, text, and container colors.',
      ),
      (
        Icons.image_outlined,
        'Premium backgrounds',
        'Exclusive wallpapers + your own uploaded images.',
      ),
      (
        Icons.text_fields,
        'Premium username fonts',
        'Over 30 hand-picked fonts for your display name.',
      ),
      (
        Icons.blur_on,
        'Sparklefall',
        'Rain your own emoji across your profile.',
      ),
    ];
    return Column(
      children: [
        for (final perk in perks) ...[
          _PerkRow(icon: perk.$1, title: perk.$2, blurb: perk.$3),
          if (perk != perks.last) const SizedBox(height: 12),
        ],
      ],
    );
  }
}

class _PerkRow extends StatelessWidget {
  const _PerkRow({
    required this.icon,
    required this.title,
    required this.blurb,
  });

  final IconData icon;
  final String title;
  final String blurb;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 22, color: authFuchsia600),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 2),
              Text(
                blurb,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Shows Play's localized price once the product query resolves. Falls
/// back to "$4.99/month" so the screen reads sensibly even when Play
/// hasn't returned a product yet (offline, unconfigured build, etc.).
class _PriceRow extends StatelessWidget {
  const _PriceRow({required this.productFuture});

  final Future<ProductDetails?>? productFuture;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ProductDetails?>(
      future: productFuture,
      builder: (context, snap) {
        final formatted = snap.data?.price ?? r'$4.99';
        return Column(
          children: [
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: formatted,
                    style: Theme.of(context).textTheme.displaySmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: authFuchsia600,
                        ),
                  ),
                  TextSpan(
                    text: ' / month',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
