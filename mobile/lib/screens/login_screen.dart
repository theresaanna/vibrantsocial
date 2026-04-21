import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/auth_api.dart';
import '../providers.dart';
import '../services/native_oauth.dart';
import '../widgets/auth_card.dart';
import 'forgot_password_screen.dart';
import 'signup_screen.dart';
import 'two_factor_screen.dart';

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

  void _openForgotPassword() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const ForgotPasswordScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final showApple = Platform.isIOS || Platform.isMacOS;
    return Form(
      key: _formKey,
      child: AuthCard(
        children: [
          const BrandedAuthHeader(lead: 'Sign in to '),
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
                foregroundColor: authFuchsia600,
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
          AuthGradientButton(
            onTap: _busy ? null : _submit,
            busy: _busy,
            label: 'Sign in',
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: const TextStyle(color: Colors.red, fontSize: 13),
            ),
          ],
          const SizedBox(height: 20),
          const AuthOrDivider(text: 'or continue with'),
          const SizedBox(height: 16),
          AuthOAuthButton(
            onTap: _busy ? null : _signInWithGoogle,
            icon: Icons.g_mobiledata,
            iconSize: 28,
            label: 'Continue with Google',
          ),
          if (showApple) ...[
            const SizedBox(height: 10),
            AuthOAuthButton(
              onTap: _busy ? null : _signInWithApple,
              icon: Icons.apple,
              iconSize: 20,
              label: 'Continue with Apple',
            ),
          ],
          const SizedBox(height: 20),
          AuthFooterLink(
            leading: "Don't have an account? ",
            action: 'Sign up',
            onTap: _busy
                ? null
                : () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const SignupScreen()),
                    ),
          ),
        ],
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
