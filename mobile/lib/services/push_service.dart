import 'dart:async';
import 'dart:io';

import 'package:ably_flutter/ably_flutter.dart' as ably;
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../api/push_api.dart';
import 'ably_service.dart';

/// Wires up native push notifications via Ably Push (FCM transport on
/// Android, APNs on iOS). The server already publishes pushes targeted at
/// an Ably `deviceId` — this class activates push on the device, learns
/// that id, hands it to the backend, and keeps foreground deliveries
/// visible via `flutter_local_notifications`.
class PushService {
  PushService(this._pushApi, this._ablyService);

  final PushApi _pushApi;
  final AblyService _ablyService;

  final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();
  StreamSubscription<ably.RemoteMessage>? _messageSub;
  StreamSubscription<ably.ErrorInfo?>? _activationSub;
  String? _registeredDeviceId;
  bool _initialized = false;

  /// Call once the user is authenticated. Idempotent — if a previous call
  /// already registered the device, this refreshes `lastSeenAt` server-side.
  Future<void> activateForViewer() async {
    if (!Platform.isAndroid && !Platform.isIOS) return;

    await _setupLocalPlugin();
    _attachStreams();

    final realtime = _ablyService.ensureClient();
    final push = ably.Push(realtime: realtime);

    if (Platform.isIOS) {
      // Android doesn't require a runtime permission for APNs; iOS does.
      // The local plugin already handles Android 13+ POST_NOTIFICATIONS.
      await push.requestPermission();
    }

    // `activate()` is idempotent — safe to call on every signed-in boot.
    await push.activate();

    // `device()` returns the LocalDevice Ably created during activation.
    // On a fresh install the id may still be null for a moment while
    // FCM/APNs hands back a token; we retry a couple of times.
    String? deviceId;
    for (var i = 0; i < 4; i++) {
      final device = await realtime.device();
      deviceId = device.id;
      if (deviceId != null && deviceId.isNotEmpty) break;
      await Future<void>.delayed(const Duration(milliseconds: 500));
    }

    if (deviceId == null || deviceId.isEmpty) {
      if (kDebugMode) debugPrint('[push] Ably returned no deviceId');
      return;
    }

    try {
      await _pushApi.register(
        ablyDeviceId: deviceId,
        platform: Platform.isAndroid ? 'android' : 'ios',
      );
      _registeredDeviceId = deviceId;
    } catch (err) {
      if (kDebugMode) debugPrint('[push] register failed: $err');
    }
  }

  /// Call on sign-out. Unregisters the device server-side so the
  /// departing user stops receiving pushes; local activation stays intact
  /// so the next signed-in user can reuse the same deviceId.
  Future<void> deactivate() async {
    final id = _registeredDeviceId;
    if (id != null) {
      try {
        await _pushApi.unregister(ablyDeviceId: id);
      } catch (err) {
        if (kDebugMode) debugPrint('[push] unregister failed: $err');
      }
      _registeredDeviceId = null;
    }
  }

  Future<void> _setupLocalPlugin() async {
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings();
    await _local.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
    );

    // Create the default channel up-front so Android 8+ notifications
    // have somewhere to land when delivered from the foreground handler.
    final androidImpl = _local.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    await androidImpl?.createNotificationChannel(
      const AndroidNotificationChannel(
        'vibrantsocial_default',
        'VibrantSocial',
        description: 'Likes, comments, friends, and list activity',
        importance: Importance.high,
      ),
    );
    // Prompt for POST_NOTIFICATIONS on Android 13+. iOS permission is
    // requested separately via ably.Push.requestPermission().
    await androidImpl?.requestNotificationsPermission();
  }

  void _attachStreams() {
    if (_initialized) return;

    _activationSub = ably.Push.activationEvents.onActivate.listen((err) {
      if (err != null && kDebugMode) {
        debugPrint('[push] activation error: ${err.message}');
      }
    });

    // Foreground deliveries don't auto-render on Android — show them via
    // the local plugin so the user still sees a heads-up. Background /
    // killed state is handled by the OS using Ably's notification field.
    _messageSub =
        ably.Push.notificationEvents.onMessage.listen((msg) async {
      final note = msg.notification;
      if (note == null) return;
      await _local.show(
        msg.hashCode,
        note.title,
        note.body,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            'vibrantsocial_default',
            'VibrantSocial',
            importance: Importance.high,
            priority: Priority.high,
          ),
          iOS: DarwinNotificationDetails(),
        ),
      );
    });

    _initialized = true;
  }

  Future<void> dispose() async {
    await _messageSub?.cancel();
    await _activationSub?.cancel();
    _messageSub = null;
    _activationSub = null;
  }
}
