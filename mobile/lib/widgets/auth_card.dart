import 'package:flutter/material.dart';

/// Shared shell + primitives for the auth screens (login, signup,
/// forgot-password). Matches the web cards: rounded-2xl Material on a
/// plain-white / near-black page, gradient brand wordmark, gradient
/// primary CTA, outlined OAuth pills, muted "or" divider.

/// Brand accents — mirror `text-fuchsia-600` / `text-blue-600` / the
/// web's `bg-gradient-to-r from-fuchsia-600 to-blue-600`.
const authFuchsia600 = Color(0xFFD946EF);
const authBlue600 = Color(0xFF2563EB);

/// Wraps auth-screen bodies in the web-matching card + page palette.
/// The scaffold background is white in light mode and zinc-950 in
/// dark; the card is white / zinc-900. Handles SafeArea + scroll +
/// max-width clamp so individual screens only worry about form fields.
class AuthCard extends StatelessWidget {
  const AuthCard({
    super.key,
    required this.children,
    this.leading,
    this.maxWidth = 420,
  });

  /// Optional leading slot (back button, close button). Sits above the
  /// card so it feels like a page affordance, not a card element.
  final Widget? leading;

  /// Column children rendered inside the card.
  final List<Widget> children;

  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final pageColor = isDark ? const Color(0xFF09090B) : Colors.white;
    final cardColor = isDark ? const Color(0xFF18181B) : Colors.white;
    return Scaffold(
      backgroundColor: pageColor,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: maxWidth),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (leading != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: leading,
                      ),
                    ),
                  Material(
                    color: cardColor,
                    elevation: 6,
                    borderRadius: BorderRadius.circular(16),
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: children,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// "{lead} VibrantSocial" heading with the wordmark painted in a
/// fuchsia→blue gradient so the brand reads as one shape. Lead text
/// (e.g. "Sign in to ", "Create your ", "Reset your password for ")
/// stays in the default foreground color.
class BrandedAuthHeader extends StatelessWidget {
  const BrandedAuthHeader({super.key, required this.lead, this.subtitle});

  final String lead;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).textTheme.headlineSmall?.copyWith(
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        );
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(lead, style: base),
            ShaderMask(
              blendMode: BlendMode.srcIn,
              shaderCallback: (bounds) => const LinearGradient(
                colors: [authFuchsia600, authBlue600],
              ).createShader(bounds),
              child: Text('VibrantSocial', style: base),
            ),
          ],
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 6),
          Text(
            subtitle!,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ],
      ],
    );
  }
}

/// Full-width fuchsia→blue gradient button used for every primary
/// CTA on the auth screens ("Sign in", "Create account", "Send reset
/// link").
class AuthGradientButton extends StatelessWidget {
  const AuthGradientButton({
    super.key,
    required this.onTap,
    required this.busy,
    required this.label,
  });

  final VoidCallback? onTap;
  final bool busy;
  final String label;

  @override
  Widget build(BuildContext context) {
    final disabled = onTap == null;
    return Opacity(
      opacity: disabled && !busy ? 0.5 : 1,
      child: Container(
        height: 44,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [authFuchsia600, authBlue600],
          ),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(8),
            onTap: onTap,
            child: Center(
              child: busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation(Colors.white),
                      ),
                    )
                  : Text(
                      label,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Horizontal-rule divider with centered muted text. Matches the web's
/// "or continue with" separator pattern.
class AuthOrDivider extends StatelessWidget {
  const AuthOrDivider({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final color =
        Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.7);
    return Row(
      children: [
        const Expanded(child: Divider()),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            text,
            style: TextStyle(fontSize: 12, color: color),
          ),
        ),
        const Expanded(child: Divider()),
      ],
    );
  }
}

/// Outlined pill button used for each OAuth provider row.
class AuthOAuthButton extends StatelessWidget {
  const AuthOAuthButton({
    super.key,
    required this.onTap,
    required this.icon,
    required this.iconSize,
    required this.label,
  });

  final VoidCallback? onTap;
  final IconData icon;
  final double iconSize;
  final String label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: iconSize),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(46),
        side: BorderSide(color: scheme.outlineVariant),
        foregroundColor: scheme.onSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        textStyle: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

/// Trailing "Already have an account? Sign in" / "Don't have an
/// account? Sign up" row. The bold fragment is the tap target (the
/// whole line is wrapped in an `InkWell` to widen the hit area).
class AuthFooterLink extends StatelessWidget {
  const AuthFooterLink({
    super.key,
    required this.leading,
    required this.action,
    required this.onTap,
  });

  final String leading;
  final String action;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text.rich(
          TextSpan(
            style: TextStyle(fontSize: 13, color: scheme.onSurfaceVariant),
            children: [
              TextSpan(text: leading),
              TextSpan(
                text: action,
                style: const TextStyle(
                  color: authFuchsia600,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
