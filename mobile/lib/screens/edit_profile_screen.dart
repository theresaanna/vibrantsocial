import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/avatar_frame.dart';
import '../models/profile_edit.dart';
import '../models/resolved_theme.dart';
import '../providers.dart';
import '../widgets/framed_avatar.dart';
import '../widgets/themed_background.dart';
import 'links_page_screen.dart';
import 'premium_screen.dart';
import 'theme_edit_screen.dart';

/// Flutter edit-profile screen. Mirrors `/profile` on web minus the
/// sensitive-content toggles (Play policy — those live on the web only
/// and the underlying API refuses to write them from mobile). Entry
/// points we punt to web have a row that opens
/// https://vibrantsocial.app/profile via the system browser.
class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  late Future<EditableProfile> _load;
  EditableProfile? _original;

  // Form state (mirrors the profile; we diff against `_original` on save).
  final _usernameCtl = TextEditingController();
  final _displayNameCtl = TextEditingController();
  final _bioCtl = TextEditingController();
  int? _birthdayMonth;
  int? _birthdayDay;
  String? _profileFrameId;

  bool _isProfilePublic = true;
  bool _hideWallFromFeed = false;
  bool _pushEnabled = false;
  bool _emailOnComment = true;
  bool _emailOnNewChat = true;
  bool _emailOnMention = true;
  bool _emailOnFriendRequest = true;
  bool _emailOnListJoinRequest = true;
  bool _emailOnSubscribedPost = true;
  bool _emailOnSubscribedComment = true;
  bool _emailOnTagPost = true;

  bool _saving = false;
  bool _avatarUploading = false;
  String? _avatarUrlOverride; // local preview URL after upload

  // Live username availability.
  Timer? _usernameDebounce;
  _UsernameStatus _usernameStatus = _UsernameStatus.idle;

  @override
  void initState() {
    super.initState();
    _load = ref.read(profileEditApiProvider).fetchMe();
    _load.then(_hydrate).catchError((_) {
      // error is rendered by the FutureBuilder
    });
  }

  void _hydrate(EditableProfile p) {
    _original = p;
    _usernameCtl.text = p.username ?? '';
    _displayNameCtl.text = p.displayName ?? '';
    _bioCtl.text = p.bio ?? '';
    _birthdayMonth = p.birthdayMonth;
    _birthdayDay = p.birthdayDay;
    _profileFrameId = p.profileFrameId;
    _isProfilePublic = p.isProfilePublic;
    _hideWallFromFeed = p.hideWallFromFeed;
    _pushEnabled = p.pushEnabled;
    _emailOnComment = p.emailOnComment;
    _emailOnNewChat = p.emailOnNewChat;
    _emailOnMention = p.emailOnMention;
    _emailOnFriendRequest = p.emailOnFriendRequest;
    _emailOnListJoinRequest = p.emailOnListJoinRequest;
    _emailOnSubscribedPost = p.emailOnSubscribedPost;
    _emailOnSubscribedComment = p.emailOnSubscribedComment;
    _emailOnTagPost = p.emailOnTagPost;
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _usernameDebounce?.cancel();
    _usernameCtl.dispose();
    _displayNameCtl.dispose();
    _bioCtl.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------
  // Username availability (debounced)
  // ---------------------------------------------------------------------

  void _onUsernameChanged(String value) {
    _usernameDebounce?.cancel();
    final trimmed = value.trim();
    // Unchanged from server → idle.
    if (trimmed == (_original?.username ?? '')) {
      setState(() => _usernameStatus = _UsernameStatus.idle);
      return;
    }
    if (!RegExp(r'^[a-zA-Z0-9_]{3,30}$').hasMatch(trimmed)) {
      setState(() => _usernameStatus = _UsernameStatus.invalid);
      return;
    }
    setState(() => _usernameStatus = _UsernameStatus.checking);
    _usernameDebounce = Timer(const Duration(milliseconds: 500), () async {
      try {
        final ok = await ref
            .read(profileEditApiProvider)
            .isUsernameAvailable(trimmed);
        if (!mounted) return;
        setState(() {
          _usernameStatus =
              ok ? _UsernameStatus.available : _UsernameStatus.taken;
        });
      } catch (_) {
        if (!mounted) return;
        setState(() => _usernameStatus = _UsernameStatus.idle);
      }
    });
  }

  // ---------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------

  ProfileUpdate _diff() {
    final patch = ProfileUpdate();
    final o = _original!;

    final username = _usernameCtl.text.trim();
    if (username.isNotEmpty && username != (o.username ?? '')) {
      patch.setString('username', username);
    }
    final displayName = _displayNameCtl.text.trim();
    if (displayName != (o.displayName ?? '')) {
      patch.setString('displayName', displayName.isEmpty ? null : displayName);
    }
    final bio = _bioCtl.text;
    if (bio != (o.bio ?? '')) {
      patch.setString('bio', bio.isEmpty ? null : bio);
    }
    if (_birthdayMonth != o.birthdayMonth || _birthdayDay != o.birthdayDay) {
      patch.setInt('birthdayMonth', _birthdayMonth);
      patch.setInt('birthdayDay', _birthdayDay);
    }
    if (_profileFrameId != o.profileFrameId) {
      // Empty string is how the server clears the column; null would be
      // ambiguous with "key not sent."
      patch.setString('profileFrameId', _profileFrameId ?? '');
    }
    if (_isProfilePublic != o.isProfilePublic) {
      patch.setBool('isProfilePublic', _isProfilePublic);
    }
    if (_hideWallFromFeed != o.hideWallFromFeed) {
      patch.setBool('hideWallFromFeed', _hideWallFromFeed);
    }
    if (_pushEnabled != o.pushEnabled) {
      patch.setBool('pushEnabled', _pushEnabled);
    }
    _diffBool(patch, 'emailOnComment', _emailOnComment, o.emailOnComment);
    _diffBool(patch, 'emailOnNewChat', _emailOnNewChat, o.emailOnNewChat);
    _diffBool(patch, 'emailOnMention', _emailOnMention, o.emailOnMention);
    _diffBool(patch, 'emailOnFriendRequest', _emailOnFriendRequest,
        o.emailOnFriendRequest);
    _diffBool(patch, 'emailOnListJoinRequest', _emailOnListJoinRequest,
        o.emailOnListJoinRequest);
    _diffBool(patch, 'emailOnSubscribedPost', _emailOnSubscribedPost,
        o.emailOnSubscribedPost);
    _diffBool(patch, 'emailOnSubscribedComment', _emailOnSubscribedComment,
        o.emailOnSubscribedComment);
    _diffBool(patch, 'emailOnTagPost', _emailOnTagPost, o.emailOnTagPost);
    return patch;
  }

  void _diffBool(ProfileUpdate patch, String key, bool next, bool prev) {
    if (next != prev) patch.setBool(key, next);
  }

  Future<void> _save() async {
    if (_original == null || _saving) return;
    if (_usernameStatus == _UsernameStatus.invalid ||
        _usernameStatus == _UsernameStatus.taken ||
        _usernameStatus == _UsernameStatus.checking) {
      _snack('Fix the username before saving.');
      return;
    }
    final patch = _diff();
    if (patch.isEmpty) {
      _snack('Nothing to save.');
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(profileEditApiProvider).save(patch);
      if (!mounted) return;
      _snack('Profile updated');
      Navigator.of(context).pop(true);
    } catch (err) {
      if (!mounted) return;
      _snack('Save failed: $err');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // ---------------------------------------------------------------------
  // Bio rich-text helpers (toolbar actions operate on `_bioCtl`)
  // ---------------------------------------------------------------------

  /// Wrap the current selection (or insert empty markers at the cursor)
  /// with the given prefix/suffix. Cursor position afterwards:
  ///  - With a selection: covers the wrapped text including markers.
  ///  - No selection: sits between the markers so typing continues inside.
  void _wrapSelection(String prefix, String suffix) {
    final text = _bioCtl.text;
    final sel = _bioCtl.selection;
    final start = sel.start < 0 ? text.length : sel.start;
    final end = sel.end < 0 ? text.length : sel.end;
    final inner = text.substring(start, end);
    final replacement = '$prefix$inner$suffix';
    final newText = text.replaceRange(start, end, replacement);
    final newStart = start + prefix.length;
    final newEnd = newStart + inner.length;
    _bioCtl.value = TextEditingValue(
      text: newText,
      selection: inner.isEmpty
          ? TextSelection.collapsed(offset: newStart)
          : TextSelection(baseOffset: newStart, extentOffset: newEnd),
    );
  }

  /// Insert `[text](url)` at the cursor. If the user had text selected
  /// we reuse it as the link label; otherwise we ask for one.
  Future<void> _insertLink() async {
    final sel = _bioCtl.selection;
    final selectedText = sel.isValid && !sel.isCollapsed
        ? _bioCtl.text.substring(sel.start, sel.end)
        : '';
    final result = await _promptForLink(initialText: selectedText);
    if (result == null || !mounted) return;
    final markdown = '[${result.text}](${result.url})';
    final start = sel.start < 0 ? _bioCtl.text.length : sel.start;
    final end = sel.end < 0 ? _bioCtl.text.length : sel.end;
    final newText = _bioCtl.text.replaceRange(start, end, markdown);
    _bioCtl.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: start + markdown.length),
    );
  }

  Future<({String text, String url})?> _promptForLink({
    required String initialText,
  }) async {
    final textCtl = TextEditingController(text: initialText);
    final urlCtl = TextEditingController();
    final result = await showDialog<({String text, String url})?>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Insert link'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: textCtl,
              decoration: const InputDecoration(
                labelText: 'Link text',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: urlCtl,
              keyboardType: TextInputType.url,
              autofocus: initialText.isNotEmpty,
              decoration: const InputDecoration(
                labelText: 'URL',
                hintText: 'https://…',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(null),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              final text = textCtl.text.trim();
              final url = urlCtl.text.trim();
              if (text.isEmpty || url.isEmpty) return;
              final uri = Uri.tryParse(url);
              if (uri == null || (uri.scheme != 'http' && uri.scheme != 'https')) {
                ScaffoldMessenger.of(ctx).showSnackBar(
                  const SnackBar(
                    content: Text('URL must start with http:// or https://'),
                  ),
                );
                return;
              }
              Navigator.of(ctx).pop((text: text, url: url));
            },
            child: const Text('Insert'),
          ),
        ],
      ),
    );
    textCtl.dispose();
    urlCtl.dispose();
    return result;
  }

  /// Pick an image, upload it through the shared `/api/upload` endpoint,
  /// and insert the returned URL as a markdown image at the cursor.
  Future<void> _insertImage() async {
    final picker = ImagePicker();
    final xfile = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 2048,
      maxHeight: 2048,
      imageQuality: 90,
    );
    if (xfile == null || !mounted) return;
    _snack('Uploading image…');
    try {
      final media = await ref
          .read(mediaApiProvider)
          .uploadImage(xfile.path, fileName: xfile.name);
      if (!mounted) return;
      final sel = _bioCtl.selection;
      final start = sel.start < 0 ? _bioCtl.text.length : sel.start;
      final end = sel.end < 0 ? _bioCtl.text.length : sel.end;
      final markdown = '![](${media.url})';
      final newText = _bioCtl.text.replaceRange(start, end, markdown);
      _bioCtl.value = TextEditingValue(
        text: newText,
        selection: TextSelection.collapsed(offset: start + markdown.length),
      );
      _snack('Image inserted');
    } catch (err) {
      if (!mounted) return;
      _snack('Image upload failed: $err');
    }
  }

  // ---------------------------------------------------------------------
  // Premium
  // ---------------------------------------------------------------------

  /// Push the in-app premium screen. If the user completes a successful
  /// subscription (the screen pops with `true`), we refetch the profile
  /// so the avatar-frame picker flips from the upgrade row to the
  /// real picker without a manual reload.
  Future<void> _openPremiumFlow() async {
    final activated = await Navigator.of(context).push<bool?>(
      MaterialPageRoute(builder: (_) => const PremiumScreen()),
    );
    if (activated == true && mounted) {
      setState(() {
        _load = ref.read(profileEditApiProvider).fetchMe();
      });
      _load.then(_hydrate).catchError((_) {});
    }
  }

  // ---------------------------------------------------------------------
  // Avatar
  // ---------------------------------------------------------------------

  Future<void> _pickAndUploadAvatar() async {
    if (_avatarUploading) return;
    final picker = ImagePicker();
    final xfile = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 2048,
      maxHeight: 2048,
      imageQuality: 90,
    );
    if (xfile == null) return;
    setState(() => _avatarUploading = true);
    try {
      final url = await ref
          .read(profileEditApiProvider)
          .uploadAvatar(xfile.path, fileName: xfile.name);
      if (!mounted) return;
      setState(() => _avatarUrlOverride = url);
      _snack('Avatar updated');
    } catch (err) {
      if (!mounted) return;
      _snack('Upload failed: $err');
    } finally {
      if (mounted) setState(() => _avatarUploading = false);
    }
  }

  // ---------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final viewerTheme = ref.watch(viewerThemeProvider);
    final textColor = viewerTheme?.colors.textColor;

    return ThemedBackground(
      theme: viewerTheme,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text('Edit profile'),
          backgroundColor: Colors.transparent,
          foregroundColor: textColor,
          actions: [
            TextButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Save'),
            ),
          ],
        ),
        body: FutureBuilder<EditableProfile>(
          future: _load,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError || snap.data == null) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('Couldn\'t load your profile.'),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: () {
                          setState(() {
                            _load =
                                ref.read(profileEditApiProvider).fetchMe();
                          });
                          _load.then(_hydrate).catchError((_) {});
                        },
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              );
            }
            final p = snap.data!;
            return DefaultTextStyle.merge(
              style:
                  textColor == null ? const TextStyle() : TextStyle(color: textColor),
              child: _buildForm(p, viewerTheme),
            );
          },
        ),
      ),
    );
  }

  Widget _buildForm(EditableProfile p, ResolvedTheme? theme) {
    final avatarUrl = _avatarUrlOverride ?? p.avatar;
    // Frame catalog loads lazily — while it's unresolved we just paint
    // the avatar without a frame overlay.
    final framesAsync = ref.watch(avatarFramesProvider);
    final framesById = framesAsync.asData?.value ?? const <String, AvatarFrame>{};
    final selectedFrame =
        _profileFrameId == null ? null : framesById[_profileFrameId!];

    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 48),
      children: [
        _ThemedCard(
          theme: theme,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _AvatarRow(
                avatarUrl: avatarUrl,
                frame: selectedFrame,
                uploading: _avatarUploading,
                onTap: _pickAndUploadAvatar,
              ),
              const SizedBox(height: 16),
              _frameSection(p, selectedFrame, framesById),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _ThemedCard(
          theme: theme,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _sectionLabel('Basic'),
              const SizedBox(height: 8),
              _usernameField(),
              const SizedBox(height: 12),
              TextField(
                controller: _displayNameCtl,
                decoration: const InputDecoration(
                  labelText: 'Display name',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              _BioToolbar(
                onBold: () => _wrapSelection('**', '**'),
                onItalic: () => _wrapSelection('*', '*'),
                onUnderline: () => _wrapSelection('<u>', '</u>'),
                onLink: _insertLink,
                onImage: _insertImage,
              ),
              TextField(
                controller: _bioCtl,
                minLines: 3,
                maxLines: 6,
                decoration: const InputDecoration(
                  labelText: 'Bio',
                  border: OutlineInputBorder(),
                  helperText:
                      'Use the toolbar for bold, italic, underline, links, and images.',
                ),
              ),
              const SizedBox(height: 12),
              _birthdayRow(),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _ThemedCard(
          theme: theme,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _sectionLabel('Profile'),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Public profile'),
                subtitle: p.suspended
                    ? const Text('Suspended accounts are locked to private.')
                    : const Text(
                        'Turn off to hide your profile from non-followers.',
                      ),
                value: _isProfilePublic && !p.suspended,
                onChanged: p.suspended
                    ? null
                    : (v) => setState(() => _isProfilePublic = v),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Hide wall posts from my feed'),
                subtitle:
                    const Text('Wall posts still appear on your profile tab.'),
                value: _hideWallFromFeed,
                onChanged: (v) => setState(() => _hideWallFromFeed = v),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.palette_outlined),
                title: const Text('Theme & background'),
                subtitle: const Text('Colors, fonts, and profile backdrop.'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const ThemeEditScreen()),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _ThemedCard(
          theme: theme,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _sectionLabel('Notifications'),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Push notifications'),
                value: _pushEnabled,
                onChanged: (v) => setState(() => _pushEnabled = v),
              ),
              const Divider(height: 24),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  'Email me when…',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
              _emailToggle('Someone comments on my post', _emailOnComment,
                  (v) => _emailOnComment = v),
              _emailToggle('Someone sends me a new chat', _emailOnNewChat,
                  (v) => _emailOnNewChat = v),
              _emailToggle("I'm mentioned", _emailOnMention,
                  (v) => _emailOnMention = v),
              _emailToggle('I get a friend request', _emailOnFriendRequest,
                  (v) => _emailOnFriendRequest = v),
              _emailToggle('Someone asks to join a list',
                  _emailOnListJoinRequest, (v) => _emailOnListJoinRequest = v),
              _emailToggle('A subscribed list gets a new post',
                  _emailOnSubscribedPost, (v) => _emailOnSubscribedPost = v),
              _emailToggle('A subscribed post gets a new comment',
                  _emailOnSubscribedComment,
                  (v) => _emailOnSubscribedComment = v),
              _emailToggle("I'm tagged in a post", _emailOnTagPost,
                  (v) => _emailOnTagPost = v),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _ThemedCard(
          theme: theme,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _sectionLabel('Account'),
              _webLink(
                Icons.mail_outline,
                'Email',
                subtitle: p.email == null
                    ? 'Not set'
                    : '${p.email}${p.emailVerified ? ' (verified)' : ' (unverified)'}',
              ),
              _webLink(
                Icons.lock_outline,
                'Password',
                subtitle: 'Change on the website.',
              ),
              _webLink(
                Icons.shield_outlined,
                'Two-factor authentication',
                subtitle: p.twoFactorEnabled ? 'Enabled' : 'Disabled',
              ),
              _webLink(
                Icons.phone_outlined,
                'Phone number',
                subtitle: p.phoneNumber == null
                    ? 'Not set'
                    : '${p.phoneNumber}${p.phoneVerified ? ' (verified)' : ''}',
              ),
              _webLink(
                Icons.link,
                'Linked accounts',
                subtitle: 'Google, Apple, and email sign-in.',
              ),
              // Premium row routes premium users to Play's native sub-
              // management screen (cancel, restart, update payment —
              // Google's UI is the source of truth). Free users instead
              // get pushed into our in-app upgrade flow.
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  p.isPremium
                      ? Icons.auto_awesome
                      : Icons.auto_awesome_outlined,
                  color: p.isPremium ? const Color(0xFFD946EF) : null,
                ),
                title: const Text('Premium subscription'),
                subtitle: Text(
                  p.isPremium ? 'Active · Manage in Google Play' : 'Not subscribed',
                ),
                trailing: Icon(
                  p.isPremium ? Icons.open_in_new : Icons.chevron_right,
                  size: 16,
                ),
                onTap: () {
                  if (p.isPremium) {
                    launchUrl(
                      Uri.parse(
                        'https://play.google.com/store/account/subscriptions'
                        '?sku=premium_monthly'
                        '&package=app.vibrantsocial.app',
                      ),
                      mode: LaunchMode.externalApplication,
                    );
                  } else {
                    _openPremiumFlow();
                  }
                },
              ),
              _webLink(
                Icons.history,
                'Bio revision history',
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.link_rounded),
                title: const Text('Links page'),
                subtitle: const Text(
                  'Customize your links.vibrantsocial.app/@username page.',
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const LinksPageScreen(),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              _webLink(
                Icons.delete_outline,
                'Delete account',
                destructive: true,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _frameSection(
    EditableProfile p,
    AvatarFrame? selectedFrame,
    Map<String, AvatarFrame> framesById,
  ) {
    // Free-tier users see a single row inviting them to upgrade —
    // framing is a paid perk. Tapping opens the in-app premium screen
    // which handles the Google Play subscription; on success the form
    // is re-hydrated so the real frame picker appears.
    if (!p.isPremium) {
      return ListTile(
        contentPadding: EdgeInsets.zero,
        leading: const Icon(Icons.auto_awesome_outlined),
        title: const Text('Avatar frames'),
        subtitle: const Text('A premium perk — tap to subscribe.'),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => _openPremiumFlow(),
      );
    }
    // Row the user lands on — shows the current selection and a button
    // that launches the full grid in a bottom sheet.
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.auto_awesome_outlined),
      title: const Text('Avatar frame'),
      subtitle: Text(
        selectedFrame == null ? 'No frame' : 'Custom frame selected',
      ),
      trailing: FilledButton.tonal(
        onPressed: () => _openFramePicker(p, framesById),
        child: const Text('Change'),
      ),
    );
  }

  Future<void> _openFramePicker(
    EditableProfile p,
    Map<String, AvatarFrame> framesById,
  ) async {
    final frames = framesById.values.toList(growable: false);
    final avatarUrl = _avatarUrlOverride ?? p.avatar;
    final picked = await showModalBottomSheet<_FramePickerResult>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.75,
          minChildSize: 0.4,
          maxChildSize: 0.95,
          expand: false,
          builder: (_, scrollController) => _FramePickerSheet(
            scrollController: scrollController,
            frames: frames,
            avatarUrl: avatarUrl,
            initialFrameId: _profileFrameId,
          ),
        );
      },
    );
    if (picked != null && mounted) {
      setState(() => _profileFrameId = picked.frameId);
    }
  }

  Widget _sectionLabel(String label) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(
          label,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
      );

  Widget _usernameField() {
    final (hint, color) = switch (_usernameStatus) {
      _UsernameStatus.idle => (null, null),
      _UsernameStatus.checking => ('Checking…', null),
      _UsernameStatus.invalid =>
        ('3–30 letters, numbers, or underscores.', Colors.red),
      _UsernameStatus.taken => ('Already taken.', Colors.red),
      _UsernameStatus.available =>
        ('Available.', Colors.green),
    };
    return TextField(
      controller: _usernameCtl,
      onChanged: _onUsernameChanged,
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9_]')),
        LengthLimitingTextInputFormatter(30),
      ],
      decoration: InputDecoration(
        labelText: 'Username',
        border: const OutlineInputBorder(),
        prefixText: '@',
        helperText: hint,
        helperStyle: color == null ? null : TextStyle(color: color),
      ),
    );
  }

  Widget _birthdayRow() {
    final months = const [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    final days = List<int>.generate(31, (i) => i + 1);
    return Row(
      children: [
        Expanded(
          flex: 3,
          child: DropdownButtonFormField<int?>(
            initialValue: _birthdayMonth,
            decoration: const InputDecoration(
              labelText: 'Birth month',
              border: OutlineInputBorder(),
            ),
            items: [
              const DropdownMenuItem<int?>(value: null, child: Text('—')),
              for (int m = 1; m <= 12; m++)
                DropdownMenuItem<int?>(value: m, child: Text(months[m - 1])),
            ],
            onChanged: (v) => setState(() {
              _birthdayMonth = v;
              // Clamp the day if we picked a month that doesn't reach it.
              if (v != null && _birthdayDay != null) {
                final max = DateTime(2001, v + 1, 0).day;
                if (_birthdayDay! > max) _birthdayDay = max;
              }
            }),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          flex: 2,
          child: DropdownButtonFormField<int?>(
            initialValue: _birthdayDay,
            decoration: const InputDecoration(
              labelText: 'Day',
              border: OutlineInputBorder(),
            ),
            items: [
              const DropdownMenuItem<int?>(value: null, child: Text('—')),
              for (final d in days)
                DropdownMenuItem<int?>(value: d, child: Text('$d')),
            ],
            onChanged: (v) => setState(() => _birthdayDay = v),
          ),
        ),
      ],
    );
  }

  Widget _emailToggle(
    String label,
    bool value,
    ValueChanged<bool> set,
  ) {
    return SwitchListTile(
      contentPadding: EdgeInsets.zero,
      dense: true,
      title: Text(label),
      value: value,
      onChanged: (v) => setState(() => set(v)),
    );
  }

  Widget _webLink(
    IconData icon,
    String label, {
    String? subtitle,
    bool destructive = false,
  }) {
    final color = destructive ? Theme.of(context).colorScheme.error : null;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, color: color),
      title: Text(label, style: TextStyle(color: color)),
      subtitle: subtitle == null ? null : Text(subtitle),
      trailing: const Icon(Icons.open_in_new, size: 16),
      onTap: () => launchUrl(
        Uri.parse('https://vibrantsocial.app/profile'),
        mode: LaunchMode.externalApplication,
      ),
    );
  }

  void _snack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }
}

enum _UsernameStatus { idle, checking, invalid, taken, available }

class _AvatarRow extends StatelessWidget {
  const _AvatarRow({
    required this.avatarUrl,
    required this.frame,
    required this.uploading,
    required this.onTap,
  });

  final String? avatarUrl;
  final AvatarFrame? frame;
  final bool uploading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Stack(
          alignment: Alignment.center,
          children: [
            FramedAvatar(
              avatarUrl: avatarUrl != null && avatarUrl!.isNotEmpty
                  ? avatarUrl
                  : null,
              frame: frame,
              size: 88,
            ),
            if (uploading)
              const CircularProgressIndicator(strokeWidth: 2.5),
          ],
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Profile photo',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 4),
              Text(
                'JPEG, PNG, GIF, or WebP — up to 10 MB.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 8),
              FilledButton.tonalIcon(
                onPressed: uploading ? null : onTap,
                icon: const Icon(Icons.upload_outlined, size: 18),
                label: const Text('Change'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Compact formatting toolbar above the bio `TextField`. Each action
/// mutates the bio text buffer directly (see `_wrapSelection`,
/// `_insertLink`, `_insertImage` in the screen state); the underlying
/// storage is a markdown-subset string the server converts to Lexical
/// JSON on save.
class _BioToolbar extends StatelessWidget {
  const _BioToolbar({
    required this.onBold,
    required this.onItalic,
    required this.onUnderline,
    required this.onLink,
    required this.onImage,
  });

  final VoidCallback onBold;
  final VoidCallback onItalic;
  final VoidCallback onUnderline;
  final VoidCallback onLink;
  final VoidCallback onImage;

  @override
  Widget build(BuildContext context) {
    final border = Theme.of(context).colorScheme.outlineVariant;
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      decoration: BoxDecoration(
        border: Border.all(color: border),
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(8),
          topRight: Radius.circular(8),
        ),
      ),
      child: Row(
        children: [
          _ToolbarButton(
            icon: Icons.format_bold,
            tooltip: 'Bold',
            onTap: onBold,
          ),
          _ToolbarButton(
            icon: Icons.format_italic,
            tooltip: 'Italic',
            onTap: onItalic,
          ),
          _ToolbarButton(
            icon: Icons.format_underline,
            tooltip: 'Underline',
            onTap: onUnderline,
          ),
          _ToolbarDivider(color: border),
          _ToolbarButton(
            icon: Icons.link,
            tooltip: 'Insert link',
            onTap: onLink,
          ),
          _ToolbarButton(
            icon: Icons.image_outlined,
            tooltip: 'Insert image',
            onTap: onImage,
          ),
        ],
      ),
    );
  }
}

class _ToolbarButton extends StatelessWidget {
  const _ToolbarButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: tooltip,
      visualDensity: VisualDensity.compact,
      onPressed: onTap,
      icon: Icon(icon, size: 20),
    );
  }
}

class _ToolbarDivider extends StatelessWidget {
  const _ToolbarDivider({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 20,
      margin: const EdgeInsets.symmetric(horizontal: 4),
      color: color,
    );
  }
}

/// Rounded section card that adopts the viewer's theme colors when one
/// is set, falling back to Material's surface color on the default
/// theme. Matches the card styling used on the profile + feed screens.
class _ThemedCard extends StatelessWidget {
  const _ThemedCard({required this.theme, required this.child});

  final ResolvedTheme? theme;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final t = theme;
    final fallback = Theme.of(context).colorScheme.surface;
    final color = t == null
        ? fallback
        : t.colors.containerColor
            .withValues(alpha: t.container.opacity.clamp(0, 100) / 100.0);
    return Material(
      color: color,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: child,
      ),
    );
  }
}

/// Result object returned from the frame picker modal. A nullable
/// [frameId] is how the sheet signals "cleared" vs "not picked" —
/// `null` frameId inside a non-null result means the user explicitly
/// chose "No frame"; a null result means they dismissed the sheet
/// without selecting anything.
class _FramePickerResult {
  const _FramePickerResult(this.frameId);
  final String? frameId;
}

/// Modal body — scrollable grid of every frame in the catalog, with a
/// "No frame" tile up top. Takes its own scroll controller so it plays
/// nicely with `DraggableScrollableSheet`.
class _FramePickerSheet extends StatefulWidget {
  const _FramePickerSheet({
    required this.scrollController,
    required this.frames,
    required this.avatarUrl,
    required this.initialFrameId,
  });

  final ScrollController scrollController;
  final List<AvatarFrame> frames;
  final String? avatarUrl;
  final String? initialFrameId;

  @override
  State<_FramePickerSheet> createState() => _FramePickerSheetState();
}

class _FramePickerSheetState extends State<_FramePickerSheet> {
  String? _selected;

  @override
  void initState() {
    super.initState();
    _selected = widget.initialFrameId;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Choose an avatar frame',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
              FilledButton(
                onPressed: () => Navigator.of(context)
                    .pop(_FramePickerResult(_selected)),
                child: const Text('Done'),
              ),
            ],
          ),
        ),
        Expanded(
          child: GridView.builder(
            controller: widget.scrollController,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 0.9,
            ),
            itemCount: widget.frames.length + 1, // +1 for the "None" tile
            itemBuilder: (context, i) {
              if (i == 0) {
                return _FrameTile(
                  label: 'No frame',
                  selected: _selected == null,
                  onTap: () => setState(() => _selected = null),
                  avatarUrl: widget.avatarUrl,
                  frame: null,
                );
              }
              final frame = widget.frames[i - 1];
              return _FrameTile(
                label: null,
                selected: _selected == frame.id,
                onTap: () => setState(() => _selected = frame.id),
                avatarUrl: widget.avatarUrl,
                frame: frame,
              );
            },
          ),
        ),
      ],
    );
  }
}

class _FrameTile extends StatelessWidget {
  const _FrameTile({
    required this.label,
    required this.selected,
    required this.onTap,
    required this.avatarUrl,
    required this.frame,
  });

  final String? label;
  final bool selected;
  final VoidCallback onTap;
  final String? avatarUrl;
  final AvatarFrame? frame;

  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? accent : Colors.transparent,
            width: 2,
          ),
          color: selected
              ? accent.withValues(alpha: 0.08)
              : Colors.transparent,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Expanded(
              child: FittedBox(
                fit: BoxFit.contain,
                child: FramedAvatar(
                  avatarUrl: avatarUrl,
                  frame: frame,
                  size: 80,
                ),
              ),
            ),
            if (label != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  label!,
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
