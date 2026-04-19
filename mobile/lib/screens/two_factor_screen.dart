import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';

/// 2FA prompt shown after a login that returned `requires2fa: true`.
/// Accepts either a 6-digit TOTP or a backup code and calls
/// `/api/v1/auth/2fa/verify` to exchange the pending token for a session.
class TwoFactorScreen extends ConsumerStatefulWidget {
  const TwoFactorScreen({super.key, required this.pendingToken});

  final String pendingToken;

  @override
  ConsumerState<TwoFactorScreen> createState() => _TwoFactorScreenState();
}

class _TwoFactorScreenState extends ConsumerState<TwoFactorScreen> {
  final _code = TextEditingController();
  bool _useBackup = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final code = _code.text.trim();
    if (code.isEmpty) {
      setState(() => _error = 'Enter your code.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final session = await ref.read(authApiProvider).verifyTwoFactor(
            pendingToken: widget.pendingToken,
            code: code,
            useBackup: _useBackup,
          );
      await ref.read(sessionProvider.notifier).set(session);
      if (mounted) Navigator.of(context).popUntil((r) => r.isFirst);
    } on DioException catch (e) {
      setState(() {
        _error = _messageFromDio(e) ?? 'Verification failed. Try again.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Two-factor auth')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    _useBackup
                        ? 'Enter a backup code'
                        : 'Enter the 6-digit code from your authenticator',
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _code,
                    autofocus: true,
                    textAlign: TextAlign.center,
                    keyboardType: _useBackup
                        ? TextInputType.text
                        : TextInputType.number,
                    inputFormatters: _useBackup
                        ? null
                        : [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(6),
                          ],
                    style: const TextStyle(fontSize: 24, letterSpacing: 6),
                    decoration: InputDecoration(
                      border: const OutlineInputBorder(),
                      hintText: _useBackup ? 'xxxx-xxxx' : '000000',
                    ),
                    onSubmitted: (_) => _submit(),
                  ),
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: _busy
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Verify'),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: Colors.red)),
                  ],
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () => setState(() {
                              _useBackup = !_useBackup;
                              _code.clear();
                              _error = null;
                            }),
                    child: Text(
                      _useBackup
                          ? 'Use authenticator code instead'
                          : 'Use a backup code instead',
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

String? _messageFromDio(DioException e) {
  final data = e.response?.data;
  if (data is Map && data['error'] is String) {
    return data['error'] as String;
  }
  return null;
}
