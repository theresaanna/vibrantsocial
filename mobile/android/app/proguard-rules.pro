# Keep annotations + line numbers so Play crash reports stay useful.
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ── Flutter / plugin registrants ────────────────────────────────────────────
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-keep class io.flutter.plugin.** { *; }
-dontwarn io.flutter.embedding.**

# ── Firebase Cloud Messaging (push) ─────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── Google Sign-In / Play Services auth ─────────────────────────────────────
-keep class com.google.android.gms.auth.** { *; }
-keep class com.google.android.gms.common.** { *; }

# ── Google Play Billing (in_app_purchase) ───────────────────────────────────
-keep class com.android.billingclient.** { *; }
-dontwarn com.android.billingclient.**

# ── Ably realtime + push ────────────────────────────────────────────────────
-keep class io.ably.** { *; }
-dontwarn io.ably.**
# Optional plugin class Ably looks up via reflection — silence the harmless
# ClassNotFoundException noise on startup.
-dontwarn io.ably.lib.objects.DefaultLiveObjectsPlugin

# ── flutter_local_notifications ─────────────────────────────────────────────
-keep class com.dexterous.** { *; }
-dontwarn com.dexterous.**

# ── OkHttp / Dio networking ─────────────────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**

# ── Desugared java.time for flutter_local_notifications ─────────────────────
-keep class j$.** { *; }
-dontwarn j$.**
