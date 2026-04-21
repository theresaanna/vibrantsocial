import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import '../widgets/auth_card.dart';

class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({super.key});

  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _username = TextEditingController();
  final _password = TextEditingController();
  DateTime? _dob;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final initial = _dob ?? DateTime(now.year - 18, now.month, now.day);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(now.year - 100),
      lastDate: now,
    );
    if (picked != null) setState(() => _dob = picked);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_dob == null) {
      setState(() => _error = 'Pick your date of birth.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final session = await ref.read(authApiProvider).signup(
            email: _email.text.trim(),
            password: _password.text,
            username: _username.text.trim(),
            dateOfBirth: _dob!,
          );
      await ref.read(sessionProvider.notifier).set(session);
    } on DioException catch (e) {
      setState(() {
        _error = _messageFromDio(e) ?? 'Sign up failed. Try again.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dobLabel = _dob == null
        ? 'Pick date of birth'
        : '${_dob!.year}-${_dob!.month.toString().padLeft(2, '0')}-${_dob!.day.toString().padLeft(2, '0')}';
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
            lead: 'Join ',
            subtitle: 'Create your account to start posting.',
          ),
          const SizedBox(height: 24),
          TextFormField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            autofillHints: const [AutofillHints.email],
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
            controller: _username,
            autocorrect: false,
            autofillHints: const [AutofillHints.newUsername],
            decoration: const InputDecoration(
              labelText: 'Username',
              hintText: '3–30 letters, numbers, or underscores',
              border: OutlineInputBorder(),
            ),
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Pick a username';
              if (!RegExp(r'^[a-zA-Z0-9_]{3,30}$').hasMatch(v.trim())) {
                return '3–30 letters, numbers, or underscores only';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _password,
            obscureText: true,
            autofillHints: const [AutofillHints.newPassword],
            decoration: const InputDecoration(
              labelText: 'Password',
              hintText: 'At least 8 characters',
              border: OutlineInputBorder(),
            ),
            validator: (v) =>
                (v == null || v.length < 8) ? 'At least 8 characters' : null,
          ),
          const SizedBox(height: 16),
          // DOB picker styled to look like the other form fields — an
          // empty-state with a calendar icon on the right.
          InkWell(
            onTap: _busy ? null : _pickDob,
            borderRadius: BorderRadius.circular(4),
            child: InputDecorator(
              decoration: const InputDecoration(
                labelText: 'Date of birth',
                border: OutlineInputBorder(),
                suffixIcon: Icon(Icons.calendar_today, size: 18),
              ),
              child: Text(
                dobLabel,
                style: TextStyle(
                  color: _dob == null
                      ? Theme.of(context).hintColor
                      : Theme.of(context).colorScheme.onSurface,
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          AuthGradientButton(
            onTap: _busy ? null : _submit,
            busy: _busy,
            label: 'Create account',
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: const TextStyle(color: Colors.red, fontSize: 13),
            ),
          ],
          const SizedBox(height: 20),
          AuthFooterLink(
            leading: 'Already have an account? ',
            action: 'Sign in',
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
