import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/auth_api.dart';
import '../providers.dart';
import '../services/native_oauth.dart';
import 'signup_screen.dart';
import 'two_factor_screen.dart';

// Brand colors — hand-picked to match `text-fuchsia-600` / `text-blue-600`
// in the web login form. Keeping them local to this file for now since
// they only show up on the auth screens.
const _kFuchsia600 = Color(0xFFD946EF);
const _kBlue600 = Color(0xFF2563EB);

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final session = await ref.read(authApiProvider).login(
            email: _email.text.trim(),
            password: _password.text,
          );
      await ref.read(sessionProvider.notifier).set(session);
    } on TwoFactorRequired catch (e) {
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => TwoFactorScreen(pendingToken: e.pendingToken),
        ),
      );
    } on DioException catch (e) {
      setState(() {
        _error = _messageFromDio(e) ?? 'Sign in failed. Try again.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _signInWithGoogle() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref.read(nativeOAuthProvider).google();
      final session = await ref.read(authApiProvider).oauthNative(
            provider: result.provider,
            idToken: result.idToken,
          );
      await ref.read(sessionProvider.notifier).set(session);
    } on OAuthCancelled {
      // User bailed — nothing to do.
    } on OAuthNotConfigured catch (e) {
      setState(() => _error = e.message);
    } on DioException catch (e) {
      setState(() => _error = _messageFromDio(e) ?? 'Google sign-in failed.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _signInWithApple() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref.read(nativeOAuthProvider).apple();
      final session = await ref.read(authApiProvider).oauthNative(
            provider: result.provider,
            idToken: result.idToken,
            apple: result.apple,
          );
      await ref.read(sessionProvider.notifier).set(session);
    } on OAuthCancelled {
      // no-op
    } on OAuthNotConfigured catch (e) {
      setState(() => _error = e.message);
    } on DioException catch (e) {
      setState(() => _error = _messageFromDio(e) ?? 'Apple sign-in failed.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openForgotPassword() async {
    // There's no mobile forgot-password screen yet — bounce to the web
    // flow in the system browser. Matches how we punt other auth admin
    // tasks (password change, 2FA setup) on the edit-profile screen.
    await launchUrl(
      Uri.parse('https://vibrantsocial.app/forgot-password'),
      mode: LaunchMode.externalApplication,
    );
  }

  @override
  Widget build(BuildContext context) {
    final showApple = Platform.isIOS || Platform.isMacOS;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    // Match the web login: plain white page in light mode, near-black
    // in dark mode (Tailwind `bg-white` / `dark:bg-zinc-950`). The
    // Material 3 default surface is slightly tinted; force the palette
    // so the page reads as brand-neutral.
    final pageColor = isDark ? const Color(0xFF09090B) : Colors.white;
    final cardColor = isDark ? const Color(0xFF18181B) : Colors.white;
    final scheme = Theme.of(context).colorScheme.copyWith(surface: cardColor);
    return Scaffold(
      backgroundColor: pageColor,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Material(
                // Mirrors the web login card: max-w-sm, rounded-2xl,
                // shadow-lg, bg-white / dark:bg-zinc-900.
                color: scheme.surface,
                elevation: 6,
                borderRadius: BorderRadius.circular(16),
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const _BrandedHeader(),
                        const SizedBox(height: 24),
                        TextFormField(
                          controller: _email,
                          autofillHints: const [AutofillHints.email],
                          keyboardType: TextInputType.emailAddress,
                          autocorrect: false,
                          decoration: const InputDecoration(
                            labelText: 'Email',
                            hintText: 'you@example.com',
                            border: OutlineInputBorder(),
                          ),
                          validator: (v) => (v == null || !v.contains('@'))
                              ? 'Enter a valid email'
                              : null,
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _password,
                          obscureText: true,
                          autofillHints: const [AutofillHints.password],
                          decoration: const InputDecoration(
                            labelText: 'Password',
                            border: OutlineInputBorder(),
                          ),
                          onFieldSubmitted: (_) => _submit(),
                          validator: (v) => (v == null || v.isEmpty)
                              ? 'Enter your password'
                              : null,
                        ),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: _busy ? null : _openForgotPassword,
                            style: TextButton.styleFrom(
                              foregroundColor: _kFuchsia600,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 4,
                                vertical: 4,
                              ),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            child: const Text('Forgot password?'),
                          ),
                        ),
                        const SizedBox(height: 12),
                        _GradientButton(
                          onTap: _busy ? null : _submit,
                          busy: _busy,
                          label: 'Sign in',
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          Text(
                            _error!,
                            style: const TextStyle(
                              color: Colors.red,
                              fontSize: 13,
                            ),
                          ),
                        ],
                        const SizedBox(height: 20),
                        const _OrDivider(text: 'or continue with'),
                        const SizedBox(height: 16),
                        _OAuthButton(
                          onTap: _busy ? null : _signInWithGoogle,
                          icon: Icons.g_mobiledata,
                          iconSize: 28,
                          label: 'Continue with Google',
                        ),
                        if (showApple) ...[
                          const SizedBox(height: 10),
                          _OAuthButton(
                            onTap: _busy ? null : _signInWithApple,
                            icon: Icons.apple,
                            iconSize: 20,
                            label: 'Continue with Apple',
                          ),
                        ],
                        const SizedBox(height: 20),
                        Text.rich(
                          TextSpan(
                            style: TextStyle(
                              fontSize: 13,
                              color: scheme.onSurfaceVariant,
                            ),
                            children: [
                              const TextSpan(text: "Don't have an account? "),
                              TextSpan(
                                text: 'Sign up',
                                style: const TextStyle(
                                  color: _kFuchsia600,
                                  fontWeight: FontWeight.w500,
                                ),
                                recognizer: null, // tap handled via wrapping gesture below
                              ),
                            ],
                          ),
                          textAlign: TextAlign.center,
                        ).asTappable(
                          onTap: _busy
                              ? null
                              : () => Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) => const SignupScreen(),
                                    ),
                                  ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// "Sign in to VibrantSocial" — the "VibrantSocial" fragment uses the
/// same fuchsia→blue gradient as the primary button so the brand
/// wordmark reads as one cohesive shape, not two halves.
class _BrandedHeader extends StatelessWidget {
  const _BrandedHeader();

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).textTheme.headlineSmall?.copyWith(
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        );
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text('Sign in to ', style: base),
        // ShaderMask paints whatever non-transparent pixels the child
        // draws — letting us apply a gradient fill to text without
        // hacking per-glyph. `dstIn` preserves the text shape so the
        // gradient is clipped to the letters.
        ShaderMask(
          blendMode: BlendMode.srcIn,
          shaderCallback: (bounds) => const LinearGradient(
            colors: [_kFuchsia600, _kBlue600],
          ).createShader(bounds),
          child: Text('VibrantSocial', style: base),
        ),
      ],
    );
  }
}

/// Full-width fuchsia→blue gradient button for the primary submit.
/// Wraps a Material + InkWell so the ripple hits the right surface.
class _GradientButton extends StatelessWidget {
  const _GradientButton({
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
            colors: [_kFuchsia600, _kBlue600],
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

/// Outlined OAuth row. Padded to match the web's taller pill-shape so
/// the provider rows feel like distinct CTAs rather than afterthoughts.
class _OAuthButton extends StatelessWidget {
  const _OAuthButton({
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

class _OrDivider extends StatelessWidget {
  const _OrDivider({required this.text});

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

/// Wraps a widget with a tap region without making its children
/// themselves taps. Used for the "Don't have an account? Sign up" line
/// — we want the whole line to be clickable, not just the "Sign up"
/// fragment, so the styling stays RichText.
extension _TappableText on Text {
  Widget asTappable({required VoidCallback? onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: this,
      ),
    );
  }
}

String? _messageFromDio(DioException e) {
  final data = e.response?.data;
  if (data is Map && data['error'] is String) {
    return data['error'] as String;
  }
  return null;
}
