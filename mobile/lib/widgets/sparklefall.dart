import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/sparkle_api.dart';
import '../models/resolved_theme.dart';
import '../providers.dart';

final _sparkleApiProvider = Provider<SparkleApi>(
  (ref) => SparkleApi(ref.watch(dioProvider)),
);

/// Falling-emoji animation layered over a profile. Mirrors the web's
/// `profile-sparklefall` component including the click-to-earn-star
/// easter egg (10/day cap, enforced server-side).
///
/// Internally uses a single [Ticker] to step all sparkles each frame
/// rather than one AnimationController per sparkle — keeps us smooth
/// at higher `maxSparkles` values.
class Sparklefall extends ConsumerStatefulWidget {
  const Sparklefall({super.key, required this.config, required this.child});

  final ResolvedSparklefall config;
  final Widget child;

  @override
  ConsumerState<Sparklefall> createState() => _SparklefallState();
}

class _Sparkle {
  _Sparkle({
    required this.glyph,
    required this.color,
    required this.x,
    required this.y,
    required this.size,
    required this.speed,
    required this.xDrift,
    required this.rotation,
    required this.rotationSpeed,
    required this.spin,
  });

  final String glyph;
  final Color? color;
  double x;
  double y;
  final double size;
  final double speed; // px/sec
  final double xDrift; // px/sec
  double rotation;
  final double rotationSpeed;
  final bool spin;
  bool popped = false;
  double popScale = 1.0;
}

class _SparklefallState extends ConsumerState<Sparklefall>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  final _rng = Random();
  final _sparkles = <_Sparkle>[];
  Duration? _lastTick;
  Duration _spawnAccumulator = Duration.zero;
  Size _viewSize = Size.zero;
  bool _capHit = false;
  Timer? _capResetTimer;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_onTick)..start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    _capResetTimer?.cancel();
    super.dispose();
  }

  void _onTick(Duration elapsed) {
    final last = _lastTick;
    _lastTick = elapsed;
    if (last == null) return;
    final dt = (elapsed - last).inMicroseconds / 1000000.0;
    if (dt <= 0 || _viewSize.isEmpty) return;

    // Spawn if under cap, on the configured interval.
    _spawnAccumulator += elapsed - last;
    final intervalMs = widget.config.interval;
    while (_spawnAccumulator.inMilliseconds >= intervalMs &&
        _sparkles.length < widget.config.maxSparkles) {
      _spawnAccumulator -= Duration(milliseconds: intervalMs);
      _spawn();
    }

    // Advance each live sparkle. Remove when off-screen.
    for (var i = _sparkles.length - 1; i >= 0; i--) {
      final s = _sparkles[i];
      if (s.popped) {
        s.popScale *= 0.85;
        if (s.popScale < 0.05) {
          _sparkles.removeAt(i);
        }
        continue;
      }
      s.y += s.speed * dt;
      s.x += s.xDrift * dt;
      if (s.spin) s.rotation += s.rotationSpeed * dt;
      if (s.y > _viewSize.height + 40) {
        _sparkles.removeAt(i);
      }
    }

    if (mounted) setState(() {});
  }

  void _spawn() {
    final cfg = widget.config;
    if (cfg.sparkles.isEmpty) return;
    final glyph = cfg.sparkles[_rng.nextInt(cfg.sparkles.length)];
    final color = cfg.colors.isEmpty
        ? null
        : _parseHex(cfg.colors[_rng.nextInt(cfg.colors.length)]);
    final size = cfg.minSize +
        _rng.nextDouble() * (cfg.maxSize - cfg.minSize).clamp(0, 1000);
    // Fall speed: 60–140 px/sec modulated by size so bigger sparkles
    // feel heavier without ever stalling.
    final speed = 60 + _rng.nextDouble() * 80 + size * 0.8;
    final wind = cfg.wind * 60; // wind ∈ [-1,1] → px/sec drift
    final xDrift = wind + (_rng.nextDouble() - 0.5) * 30;
    final rotationSpeed =
        (_rng.nextDouble() - 0.5) * (pi * 2); // ±1 rotation/sec
    final spin = _rng.nextDouble() < 0.7;

    _sparkles.add(_Sparkle(
      glyph: glyph,
      color: color,
      x: _rng.nextDouble() * _viewSize.width,
      y: -size,
      size: size,
      speed: speed,
      xDrift: xDrift,
      rotation: 0,
      rotationSpeed: rotationSpeed,
      spin: spin,
    ));
  }

  Future<void> _onTap(TapDownDetails d) async {
    // Find the topmost live sparkle under the tap.
    _Sparkle? hit;
    for (final s in _sparkles.reversed) {
      if (s.popped) continue;
      final cx = s.x + s.size / 2;
      final cy = s.y + s.size / 2;
      final dx = d.localPosition.dx - cx;
      final dy = d.localPosition.dy - cy;
      // Generous hit radius — emoji glyphs are smaller than their box.
      if (dx * dx + dy * dy <= (s.size * 0.8) * (s.size * 0.8)) {
        hit = s;
        break;
      }
    }
    if (hit == null || _capHit) return;

    hit.popped = true;
    try {
      final reward = await ref.read(_sparkleApiProvider).claimReward();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          duration: const Duration(seconds: 2),
          content: Text(
            '🌟 +${reward.awarded} star! ${reward.total} total',
          ),
        ),
      );
    } catch (err) {
      // 429 means daily cap hit — show a one-time info and stop
      // claiming for the rest of this widget's lifetime.
      final statusCode = _statusFromError(err);
      if (statusCode == 429) {
        _capHit = true;
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Ten catches today, you are a star! Come back tomorrow.',
              ),
            ),
          );
        }
      }
      // For any other failure we silently drop — the sparkle still pops
      // visually so the tap feels responsive.
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        _viewSize = Size(constraints.maxWidth, constraints.maxHeight);
        return Stack(
          fit: StackFit.expand,
          children: [
            widget.child,
            if (widget.config.enabled)
              // `IgnorePointer` wraps the whole layer by default so the
              // underlying UI stays interactive; the inner GestureDetector
              // re-enables pointer events on the sparkle hit area only.
              GestureDetector(
                behavior: HitTestBehavior.translucent,
                onTapDown: _onTap,
                child: CustomPaint(
                  painter: _SparklePainter(sparkles: _sparkles),
                  size: Size.infinite,
                ),
              ),
          ],
        );
      },
    );
  }
}

class _SparklePainter extends CustomPainter {
  _SparklePainter({required this.sparkles});

  final List<_Sparkle> sparkles;

  @override
  void paint(Canvas canvas, Size size) {
    for (final s in sparkles) {
      final textStyle = TextStyle(
        fontSize: s.size,
        color: s.color, // null falls back to glyph's native emoji colors
      );
      final painter = TextPainter(
        text: TextSpan(text: s.glyph, style: textStyle),
        textDirection: TextDirection.ltr,
      )..layout();

      canvas.save();
      final cx = s.x + painter.width / 2;
      final cy = s.y + painter.height / 2;
      canvas.translate(cx, cy);
      if (s.spin) canvas.rotate(s.rotation);
      final scale = s.popped ? s.popScale : 1.0;
      canvas.scale(scale, scale);
      painter.paint(
        canvas,
        Offset(-painter.width / 2, -painter.height / 2),
      );
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _SparklePainter old) =>
      old.sparkles != sparkles;
}

Color? _parseHex(String hex) {
  final clean = hex.replaceFirst('#', '');
  if (clean.length != 6) return null;
  final v = int.tryParse(clean, radix: 16);
  if (v == null) return null;
  return Color(0xFF000000 | v);
}

int? _statusFromError(Object err) {
  // Grab the status off a DioException without importing dio here —
  // keep this widget framework-agnostic in case we ever swap HTTP
  // clients.
  try {
    final dynamic d = err;
    final resp = d.response;
    if (resp == null) return null;
    final status = resp.statusCode;
    return status is int ? status : null;
  } catch (_) {
    return null;
  }
}
