import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import '../widgets/auth_card.dart';

/// Mobile "Forgot password" screen. Sends a reset link email by POSTing
/// to `/api/v1/auth/forgot-password`. Server responds the same way for
/// unknown email / OAuth-only users / successful sends — we surface
/// that message verbatim so the UI can't be used to enumerate accounts.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState
    extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _busy = false;
  String? _error;
  String? _sentMessage;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final message = await ref.read(authApiProvider).requestPasswordReset(
            email: _email.text.trim(),
          );
      if (!mounted) return;
      setState(() => _sentMessage = message);
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() => _error = _messageFromDio(e) ??
          'Something went wrong. Try again in a moment.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: AuthCard(
        leading: IconButton(
          tooltip: 'Back',
          onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(Icons.arrow_back),
        ),
        children: [
          const BrandedAuthHeader(
            lead: 'Reset your ',
            subtitle:
                'Enter the email on your account and we\'ll send a reset link.',
          ),
          const SizedBox(height: 24),
          if (_sentMessage != null)
            // Green success card — matches the tone of the web reset-
            // password success state.
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: Colors.green.withValues(alpha: 0.3),
                ),
              ),
              child: Text(
                _sentMessage!,
                style: const TextStyle(fontSize: 13),
              ),
            )
          else ...[
            TextFormField(
              controller: _email,
              autofillHints: const [AutofillHints.email],
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Email',
                hintText: 'you@example.com',
                border: OutlineInputBorder(),
              ),
              onFieldSubmitted: (_) => _submit(),
              validator: (v) => (v == null || !v.contains('@'))
                  ? 'Enter a valid email'
                  : null,
            ),
            const SizedBox(height: 20),
            AuthGradientButton(
              onTap: _busy ? null : _submit,
              busy: _busy,
              label: 'Send reset link',
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: const TextStyle(color: Colors.red, fontSize: 13),
              ),
            ],
          ],
          const SizedBox(height: 20),
          AuthFooterLink(
            leading: 'Remembered it? ',
            action: 'Back to sign in',
            onTap: _busy ? null : () => Navigator.of(context).pop(),
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
