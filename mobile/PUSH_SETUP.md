# Native push notifications (Android)

Push delivery goes through **Ably Push**, which uses FCM as the OS-level
transport. You don't need to write any Firebase code, but a one-time
Firebase/Ably dashboard setup is required.

## 1. Firebase project

- Project: `vibrantsocial-f04d6` (already created)
- Android app package: `app.vibrantsocial.app`
- `mobile/android/app/google-services.json` is checked in. Replace it if
  you ever rotate the Firebase project.

## 2. Ably → FCM link (one-time)

In the Ably dashboard:

1. Open the app you use for realtime, go to **Push Notifications → Setup**.
2. Under **FCM (Firebase Cloud Messaging)**, paste the FCM *server key*
   (found in Firebase console → Project settings → Cloud Messaging →
   legacy server key, or upload a service-account JSON for FCM v1).
3. Save.

Once that's wired, `client.push.admin.publish({ deviceId }, payload)` on
the server (see `src/lib/ably-push.ts`) will fan out to FCM without
anything else to configure.

## 3. Server-side env

`ABLY_API_KEY` must be set — we reuse the same key already used for
realtime. When unset, `sendMobilePushToUser()` no-ops so CI and local dev
don't need Ably credentials.

## 4. Flutter side

- `pubspec.yaml` pulls in `ably_flutter` (already present) and
  `flutter_local_notifications` for foreground deliveries.
- `lib/services/push_service.dart` activates Ably Push on sign-in, grabs
  the `deviceId`, and POSTs it to `/api/v1/notifications/mobile-device`.
- On sign-out, the device is unregistered server-side.
- `AndroidManifest.xml` declares `POST_NOTIFICATIONS` (Android 13+
  runtime permission prompted by the local notifications plugin).

## 5. Deep-linking (follow-up)

Notification payloads include data fields (`type`, `postId`, `commentId`,
etc.) so the Flutter client can route on tap. For v1 the app just opens
to the home feed; a follow-up will add per-type navigation.

## Troubleshooting

- **Pushes don't show up**: check the Ably dashboard → Push Notifications
  → Activity tab. Delivery failures are logged there with the FCM error
  code.
- **`device.id` is null** on the Flutter side: the activation request
  hit the OS before FCM had a token — usually transient on first launch.
  Retry after a few seconds or on next cold start.
- **401 registering device**: the mobile JWT expired. The Dio auth
  interceptor will clear it and bounce the user back to login, at which
  point a fresh activation runs.
