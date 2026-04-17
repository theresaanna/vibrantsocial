import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:vibrantsocial/main.dart';

void main() {
  testWidgets('ThemePreviewScreen renders input + fetch button on launch',
      (tester) async {
    await tester.pumpWidget(const ProviderScope(child: VibrantSocialApp()));

    expect(find.text('Theme preview'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Fetch'), findsOneWidget);
    expect(find.text('Enter a username to fetch.'), findsOneWidget);
  });
}
