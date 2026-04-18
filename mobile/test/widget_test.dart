import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:vibrantsocial/main.dart';

void main() {
  testWidgets('AuthGate renders LoginScreen when no session is set',
      (tester) async {
    await tester.pumpWidget(const ProviderScope(child: VibrantSocialApp()));
    await tester.pump();

    expect(find.text('Sign in'), findsAtLeastNWidgets(1));
    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(find.widgetWithText(TextButton, 'Need an account? Sign up'),
        findsOneWidget);
  });
}
