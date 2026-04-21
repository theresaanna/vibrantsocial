import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../api/post_api.dart';
import '../providers.dart';
import '../widgets/gif_picker.dart';
import '../widgets/themed_background.dart';
import 'premium_screen.dart';
import 'scheduled_posts_screen.dart';

/// Minimal post composer — text + tags + content warnings. Auto-link
/// and auto-YouTube detection happen server-side (see lib/compose.ts),
/// so pasting a URL or YouTube link is enough; the user doesn't need a
/// separate "insert link" control.
///
/// Image attachments, poll builder, and AI tag suggestions are the
/// planned fast-follows for this slice.
class ComposeScreen extends ConsumerStatefulWidget {
  const ComposeScreen({super.key});

  @override
  ConsumerState<ComposeScreen> createState() => _ComposeScreenState();
}

class _ComposeScreenState extends ConsumerState<ComposeScreen> {
  final _textCtrl = TextEditingController();
  final _tagCtrl = TextEditingController();
  final _tags = <String>[];
  final _images = <_PendingImage>[];
  _PollDraft? _poll;
  bool _isNsfw = false;
  bool _isSensitive = false;
  bool _isGraphicNudity = false;
  bool _submitting = false;
  bool _generatingTags = false;
  bool _pickingImage = false;
  DateTime? _scheduledFor;
  String? _error;

  @override
  void dispose() {
    _textCtrl.dispose();
    _tagCtrl.dispose();
    _poll?.dispose();
    super.dispose();
  }

  bool get _canSubmit {
    if (_submitting) return false;
    final hasText = _textCtrl.text.trim().isNotEmpty;
    final hasImage = _images.any((i) => i.uploaded != null);
    final hasValidPoll = _poll?.isValid ?? false;
    return hasText || hasImage || hasValidPoll;
  }

  /// Launches the system photo picker, then uploads the chosen image to
  /// Vercel Blob via `/api/upload`. Displays a local placeholder tile
  /// while the upload is in flight so the UI stays responsive.
  Future<void> _addImage() async {
    if (_pickingImage) return;
    setState(() => _pickingImage = true);
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 2000,
        maxHeight: 2000,
        imageQuality: 88,
      );
      if (picked == null) return;
      final pending = _PendingImage(localPath: picked.path);
      setState(() => _images.add(pending));
      try {
        final uploaded = await ref
            .read(mediaApiProvider)
            .uploadImage(picked.path, fileName: picked.name);
        if (!mounted) return;
        setState(() {
          pending.uploaded = uploaded.url;
          pending.uploadError = null;
        });
      } on DioException catch (e) {
        if (!mounted) return;
        final msg = e.response?.data is Map
            ? ((e.response!.data as Map)['error']?.toString() ??
                'Upload failed')
            : 'Upload failed';
        setState(() => pending.uploadError = msg);
      }
    } finally {
      if (mounted) setState(() => _pickingImage = false);
    }
  }

  void _removeImage(_PendingImage image) {
    setState(() => _images.remove(image));
  }

  /// Open the shared Giphy picker. Picked GIFs skip the upload pipe —
  /// we stash the Giphy CDN URL directly on a pre-"uploaded" pending
  /// row so it flows through the same thumbnail + submit paths images
  /// use.
  Future<void> _addGif() async {
    final gif = await pickGif(context);
    if (gif == null || !mounted) return;
    setState(() => _images.add(_PendingImage.hosted(gif.url)));
  }

  /// Prompt for a URL, then insert a markdown link using the current
  /// TextField selection as the label (or a placeholder when empty).
  /// The server parses `[label](url)` into a proper Lexical link node.
  Future<void> _insertLink() async {
    final sel = _textCtrl.selection;
    final text = _textCtrl.text;
    if (!sel.isValid) return;
    final label = sel.isCollapsed
        ? ''
        : text.substring(sel.start, sel.end);
    final url = await showDialog<String>(
      context: context,
      builder: (ctx) => _LinkPromptDialog(initialLabel: label),
    );
    if (url == null || url.trim().isEmpty) return;
    final href = url.trim();
    final effectiveLabel = label.isNotEmpty ? label : href;
    final md = '[$effectiveLabel]($href)';
    final replaced = text.replaceRange(sel.start, sel.end, md);
    final caret = sel.start + md.length;
    _textCtrl.value = TextEditingValue(
      text: replaced,
      selection: TextSelection.collapsed(offset: caret),
    );
    setState(() {});
  }

  /// Wrap the current TextField selection with [marker] on each side.
  /// `**` produces bold, `*` produces italic — matches the markdown-ish
  /// syntax the server parses.
  void _wrapSelection(String marker) {
    final sel = _textCtrl.selection;
    final text = _textCtrl.text;
    if (!sel.isValid) return;
    final start = sel.start;
    final end = sel.end;
    final wrapped =
        '${text.substring(0, start)}$marker${text.substring(start, end)}$marker${text.substring(end)}';
    // Keep the cursor positioned inside the wrapper so continued typing
    // lands between the markers when the user hit Bold/Italic on an
    // empty selection.
    final caret = end == start
        ? start + marker.length
        : end + (marker.length * 2);
    _textCtrl.value = TextEditingValue(
      text: wrapped,
      selection: TextSelection.collapsed(offset: caret),
    );
    setState(() {});
  }

  /// Ask the server for AI-suggested tags based on the current draft.
  /// New (non-duplicate) suggestions are merged into the chip list so
  /// the user can one-tap remove ones they don't want.
  Future<void> _generateTags() async {
    final text = _textCtrl.text.trim();
    if (text.isEmpty || _generatingTags) return;
    setState(() {
      _generatingTags = true;
      _error = null;
    });
    try {
      final suggestions = await ref.read(postApiProvider).suggestTags(text: text);
      if (!mounted) return;
      final toAdd = suggestions.where((t) => !_tags.contains(t)).toList();
      setState(() => _tags.addAll(toAdd));
    } on DioException catch (e) {
      final msg = e.response?.data is Map
          ? ((e.response!.data as Map)['error']?.toString() ??
              'Could not generate tags.')
          : 'Could not generate tags.';
      if (mounted) setState(() => _error = msg);
    } finally {
      if (mounted) setState(() => _generatingTags = false);
    }
  }

  void _commitTag() {
    final raw = _tagCtrl.text.trim();
    if (raw.isEmpty) return;
    final normalized = raw.replaceAll(RegExp(r'^#'), '').toLowerCase();
    if (normalized.isEmpty || _tags.contains(normalized)) {
      _tagCtrl.clear();
      return;
    }
    setState(() {
      _tags.add(normalized);
      _tagCtrl.clear();
    });
  }

  /// Opens a date + time picker, stages `_scheduledFor` if the user
  /// confirms. Premium-only; free users get punted to `PremiumScreen`
  /// (server would 403 otherwise — this just surfaces it nicely).
  Future<void> _pickSchedule() async {
    final session = ref.read(sessionProvider);
    final isPremium = session?.user.tier == 'premium';
    if (!isPremium) {
      final activated = await Navigator.of(context).push<bool?>(
        MaterialPageRoute(builder: (_) => const PremiumScreen()),
      );
      if (activated != true) return;
      // `session.user.tier` is cached — re-check via fresh claim the
      // next build. For now just fall through so the picker opens.
    }
    if (!mounted) return;

    final now = DateTime.now();
    // Default to "tomorrow same hour" to minimize scrolling; clamped to
    // the server's 5-minute-future minimum.
    final seedDate = _scheduledFor ?? now.add(const Duration(days: 1));
    final picked = await showDatePicker(
      context: context,
      initialDate: seedDate,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked == null || !mounted) return;

    final seedTime = _scheduledFor != null
        ? TimeOfDay.fromDateTime(_scheduledFor!)
        : TimeOfDay.fromDateTime(seedDate);
    final time = await showTimePicker(
      context: context,
      initialTime: seedTime,
    );
    if (time == null || !mounted) return;

    final combined = DateTime(
      picked.year,
      picked.month,
      picked.day,
      time.hour,
      time.minute,
    );
    if (combined.difference(DateTime.now()) < const Duration(minutes: 5)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Pick a time at least 5 minutes from now.'),
        ),
      );
      return;
    }
    setState(() => _scheduledFor = combined);
  }

  void _openScheduledList() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const ScheduledPostsScreen()),
    );
  }

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final pollPayload = _poll?.toPayload();
      final result = await ref.read(postApiProvider).createPost(
            CreatePostInput(
              text: _textCtrl.text.trim(),
              tags: List.of(_tags),
              images: [
                for (final img in _images)
                  if (img.uploaded != null)
                    (src: img.uploaded!, altText: null),
              ],
              poll: pollPayload,
              isNsfw: _isNsfw,
              isSensitive: _isSensitive,
              isGraphicNudity: _isGraphicNudity,
              scheduledFor: _scheduledFor,
            ),
          );
      if (!mounted) return;
      // Scheduled posts don't go into the feed yet — no provider
      // invalidation needed. Live posts refresh both the home feed and
      // the author's profile so the new card shows immediately.
      if (result is PublishedPostResult) {
        ref.read(feedProvider.notifier).refresh();
        final username = ref.read(sessionProvider)?.user.username;
        if (username != null) {
          ref.read(profilePostsProvider(username).notifier).refresh();
        }
      } else if (result is ScheduledPostResult) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Scheduled for ${_formatSchedule(result.scheduledFor.toLocal())}',
            ),
          ),
        );
      }
      Navigator.of(context).pop(true);
    } on DioException catch (e) {
      final msg = e.response?.data is Map
          ? ((e.response!.data as Map)['error']?.toString() ??
              'Could not publish. Try again.')
          : 'Could not publish. Try again.';
      setState(() => _error = msg);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewerTheme = ref.watch(viewerThemeProvider);
    final colors = viewerTheme?.colors;
    final opacity = viewerTheme?.container.opacity ?? 100;
    final containerColor = colors == null
        ? Theme.of(context).colorScheme.surface
        : colors.containerColor.withValues(alpha: opacity.clamp(0, 100) / 100.0);
    final textColor =
        colors?.textColor ?? Theme.of(context).colorScheme.onSurface;

    return ThemedBackground(
      theme: viewerTheme,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          title: const Text('New post'),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: FilledButton(
                onPressed: _canSubmit ? _submit : null,
                child: _submitting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Post'),
              ),
            ),
          ],
        ),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(12),
            child: Material(
              color: containerColor,
              borderRadius: BorderRadius.circular(16),
              child: DefaultTextStyle.merge(
                style: TextStyle(color: textColor),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
              _FormatToolbar(
                onBold: () => _wrapSelection('**'),
                onItalic: () => _wrapSelection('*'),
                onLink: _insertLink,
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _textCtrl,
                minLines: 6,
                maxLines: null,
                autofocus: true,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  hintText:
                      'What do you want to share? Links and YouTube URLs '
                      'auto-preview.',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              _ImageStrip(
                images: _images,
                onAdd: _addImage,
                onAddGif: _addGif,
                onRemove: _removeImage,
                busyAdding: _pickingImage,
              ),
              const SizedBox(height: 16),
              _PollBuilder(
                draft: _poll,
                onAdd: () => setState(() => _poll = _PollDraft.fresh()),
                onRemove: () {
                  _poll?.dispose();
                  setState(() => _poll = null);
                },
                onChanged: () => setState(() {}),
              ),
              const SizedBox(height: 16),
              _TagsRow(
                controller: _tagCtrl,
                tags: _tags,
                onSubmit: _commitTag,
                onRemove: (t) => setState(() => _tags.remove(t)),
                canGenerate: _textCtrl.text.trim().isNotEmpty,
                generating: _generatingTags,
                onGenerate: _generateTags,
              ),
              const SizedBox(height: 16),
              _WarningToggles(
                isNsfw: _isNsfw,
                isSensitive: _isSensitive,
                isGraphicNudity: _isGraphicNudity,
                onNsfw: (v) => setState(() => _isNsfw = v),
                onSensitive: (v) => setState(() => _isSensitive = v),
                onGraphic: (v) => setState(() => _isGraphicNudity = v),
              ),
              const SizedBox(height: 16),
              _ScheduleRow(
                scheduledFor: _scheduledFor,
                onPickTap: _pickSchedule,
                onClear: () => setState(() => _scheduledFor = null),
                onManageTap: _openScheduledList,
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!,
                    style: const TextStyle(color: Colors.redAccent)),
              ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TagsRow extends StatelessWidget {
  const _TagsRow({
    required this.controller,
    required this.tags,
    required this.onSubmit,
    required this.onRemove,
    required this.canGenerate,
    required this.generating,
    required this.onGenerate,
  });

  final TextEditingController controller;
  final List<String> tags;
  final VoidCallback onSubmit;
  final void Function(String) onRemove;
  final bool canGenerate;
  final bool generating;
  final VoidCallback onGenerate;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                'Tags',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            TextButton.icon(
              onPressed: canGenerate && !generating ? onGenerate : null,
              icon: generating
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.auto_awesome, size: 18),
              label: Text(generating ? 'Generating…' : 'Generate'),
            ),
          ],
        ),
        const SizedBox(height: 6),
        if (tags.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final t in tags)
                  InputChip(
                    label: Text('#$t'),
                    onDeleted: () => onRemove(t),
                  ),
              ],
            ),
          ),
        TextField(
          controller: controller,
          decoration: const InputDecoration(
            hintText: 'Add a tag (press enter to add)',
            prefixText: '#',
            border: OutlineInputBorder(),
            isDense: true,
          ),
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => onSubmit(),
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9_-]')),
          ],
        ),
      ],
    );
  }
}

class _FormatToolbar extends StatelessWidget {
  const _FormatToolbar({
    required this.onBold,
    required this.onItalic,
    required this.onLink,
  });

  final VoidCallback onBold;
  final VoidCallback onItalic;
  final VoidCallback onLink;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(
          tooltip: 'Bold (**text**)',
          icon: const Icon(Icons.format_bold),
          onPressed: onBold,
        ),
        IconButton(
          tooltip: 'Italic (*text*)',
          icon: const Icon(Icons.format_italic),
          onPressed: onItalic,
        ),
        IconButton(
          tooltip: 'Link',
          icon: const Icon(Icons.link),
          onPressed: onLink,
        ),
      ],
    );
  }
}

/// Simple modal that asks the user for a URL. The current selection
/// is shown as a read-only label so they know what text the link
/// will wrap.
class _LinkPromptDialog extends StatefulWidget {
  const _LinkPromptDialog({required this.initialLabel});

  final String initialLabel;

  @override
  State<_LinkPromptDialog> createState() => _LinkPromptDialogState();
}

class _LinkPromptDialogState extends State<_LinkPromptDialog> {
  final _urlCtrl = TextEditingController();

  @override
  void dispose() {
    _urlCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    final url = _urlCtrl.text.trim();
    if (url.isEmpty) return;
    Navigator.of(context).pop(url);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Add link'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.initialLabel.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                'Linking: ${widget.initialLabel}',
                style: const TextStyle(fontStyle: FontStyle.italic),
              ),
            ),
          TextField(
            controller: _urlCtrl,
            autofocus: true,
            keyboardType: TextInputType.url,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _submit(),
            decoration: const InputDecoration(
              labelText: 'URL',
              hintText: 'https://example.com',
              border: OutlineInputBorder(),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(onPressed: _submit, child: const Text('Add')),
      ],
    );
  }
}

/// Compose-time poll state. Owns its own TextEditingControllers so the
/// composer can surface add/remove/edit interactions without rebuilding
/// the widget tree whenever a character changes.
class _PollDraft {
  _PollDraft._(this.question, this.options);

  factory _PollDraft.fresh() {
    return _PollDraft._(
      TextEditingController(),
      [TextEditingController(), TextEditingController()],
    );
  }

  final TextEditingController question;
  final List<TextEditingController> options;

  static const int maxOptions = 6;
  static const int minOptions = 2;

  bool get canAddOption => options.length < maxOptions;
  bool get canRemoveOption => options.length > minOptions;

  bool get isValid {
    if (question.text.trim().isEmpty) return false;
    final filled = options.where((c) => c.text.trim().isNotEmpty).length;
    return filled >= minOptions;
  }

  void addOption() {
    if (!canAddOption) return;
    options.add(TextEditingController());
  }

  void removeOption(int index) {
    if (!canRemoveOption) return;
    final ctrl = options.removeAt(index);
    ctrl.dispose();
  }

  ({String question, List<String> options})? toPayload() {
    if (!isValid) return null;
    return (
      question: question.text.trim(),
      options: [
        for (final c in options)
          if (c.text.trim().isNotEmpty) c.text.trim(),
      ],
    );
  }

  void dispose() {
    question.dispose();
    for (final c in options) {
      c.dispose();
    }
  }
}

class _PollBuilder extends StatelessWidget {
  const _PollBuilder({
    required this.draft,
    required this.onAdd,
    required this.onRemove,
    required this.onChanged,
  });

  final _PollDraft? draft;
  final VoidCallback onAdd;
  final VoidCallback onRemove;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final d = draft;
    if (d == null) {
      return Align(
        alignment: Alignment.centerLeft,
        child: OutlinedButton.icon(
          onPressed: onAdd,
          icon: const Icon(Icons.poll_outlined),
          label: const Text('Add a poll'),
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Theme.of(context).colorScheme.outlineVariant,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Poll',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              IconButton(
                tooltip: 'Remove poll',
                icon: const Icon(Icons.close),
                onPressed: onRemove,
              ),
            ],
          ),
          const SizedBox(height: 4),
          TextField(
            controller: d.question,
            onChanged: (_) => onChanged(),
            decoration: const InputDecoration(
              hintText: 'Ask something',
              border: OutlineInputBorder(),
              isDense: true,
            ),
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 10),
          for (var i = 0; i < d.options.length; i++)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: d.options[i],
                      onChanged: (_) => onChanged(),
                      decoration: InputDecoration(
                        hintText: 'Option ${i + 1}',
                        border: const OutlineInputBorder(),
                        isDense: true,
                      ),
                      textInputAction: i == d.options.length - 1
                          ? TextInputAction.done
                          : TextInputAction.next,
                    ),
                  ),
                  if (d.canRemoveOption)
                    IconButton(
                      tooltip: 'Remove option',
                      icon: const Icon(Icons.remove_circle_outline),
                      onPressed: () {
                        d.removeOption(i);
                        onChanged();
                      },
                    ),
                ],
              ),
            ),
          if (d.canAddOption)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () {
                  d.addOption();
                  onChanged();
                },
                icon: const Icon(Icons.add),
                label: const Text('Add option'),
              ),
            ),
        ],
      ),
    );
  }
}

/// Local state for one pending image attachment — holds the picked file
/// path for the immediate thumbnail and, once uploaded, the Vercel Blob
/// URL we'll submit with the post.
class _PendingImage {
  _PendingImage({required this.localPath});

  /// Construct a `_PendingImage` for a hosted URL we don't need to
  /// upload — used for Giphy picks. `localPath` stays empty; the
  /// thumbnail branch keys on `uploaded != null` so it renders the
  /// remote URL directly.
  _PendingImage.hosted(String url)
      : localPath = '',
        uploaded = url;

  final String localPath;
  String? uploaded;
  String? uploadError;
}

class _ImageStrip extends StatelessWidget {
  const _ImageStrip({
    required this.images,
    required this.onAdd,
    required this.onAddGif,
    required this.onRemove,
    required this.busyAdding,
  });

  final List<_PendingImage> images;
  final VoidCallback onAdd;
  final VoidCallback onAddGif;
  final void Function(_PendingImage) onRemove;
  final bool busyAdding;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 88,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (final img in images)
            _Thumbnail(image: img, onRemove: () => onRemove(img)),
          _AddImageTile(onTap: onAdd, busy: busyAdding),
          const SizedBox(width: 6),
          _AddGifTile(onTap: onAddGif),
        ],
      ),
    );
  }
}

class _Thumbnail extends StatelessWidget {
  const _Thumbnail({required this.image, required this.onRemove});

  final _PendingImage image;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: SizedBox(
        width: 88,
        height: 88,
        child: Stack(
          fit: StackFit.expand,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: image.uploaded != null
                  ? CachedNetworkImage(
                      imageUrl: image.uploaded!,
                      fit: BoxFit.cover,
                    )
                  : Image.file(
                      File(image.localPath),
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => Container(
                        color: Theme.of(context)
                            .colorScheme
                            .surfaceContainerHighest,
                        alignment: Alignment.center,
                        child: const Icon(Icons.image),
                      ),
                    ),
            ),
            if (image.uploaded == null && image.uploadError == null)
              const Positioned.fill(
                child: ColoredBox(
                  color: Color(0x66000000),
                  child: Center(
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ),
            if (image.uploadError != null)
              Positioned.fill(
                child: Container(
                  color: const Color(0x80000000),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.error_outline,
                    color: Colors.redAccent,
                  ),
                ),
              ),
            Positioned(
              top: -4,
              right: -4,
              child: Material(
                color: Colors.black54,
                shape: const CircleBorder(),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: onRemove,
                  child: const Padding(
                    padding: EdgeInsets.all(4),
                    child: Icon(Icons.close, size: 14, color: Colors.white),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AddImageTile extends StatelessWidget {
  const _AddImageTile({required this.onTap, required this.busy});

  final VoidCallback onTap;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: busy ? null : onTap,
      child: Container(
        width: 88,
        height: 88,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: Theme.of(context).colorScheme.outlineVariant,
            style: BorderStyle.solid,
            width: 1,
          ),
        ),
        alignment: Alignment.center,
        child: busy
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.add_photo_alternate_outlined),
                  SizedBox(height: 4),
                  Text('Add image', style: TextStyle(fontSize: 11)),
                ],
              ),
      ),
    );
  }
}

class _AddGifTile extends StatelessWidget {
  const _AddGifTile({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Container(
        width: 88,
        height: 88,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: Theme.of(context).colorScheme.outlineVariant,
          ),
        ),
        alignment: Alignment.center,
        child: const Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.gif_box_outlined),
            SizedBox(height: 4),
            Text('GIF', style: TextStyle(fontSize: 11)),
          ],
        ),
      ),
    );
  }
}

/// Row showing the current schedule (if any) + controls to pick or
/// clear it, plus a shortcut to the "my scheduled posts" queue. Free
/// users see the label with a premium badge — tapping pushes them at
/// the upgrade screen via `_pickSchedule`.
class _ScheduleRow extends StatelessWidget {
  const _ScheduleRow({
    required this.scheduledFor,
    required this.onPickTap,
    required this.onClear,
    required this.onManageTap,
  });

  final DateTime? scheduledFor;
  final VoidCallback onPickTap;
  final VoidCallback onClear;
  final VoidCallback onManageTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isScheduled = scheduledFor != null;
    return Row(
      children: [
        OutlinedButton.icon(
          onPressed: onPickTap,
          icon: const Icon(Icons.schedule, size: 18),
          label: Text(
            isScheduled
                ? 'Scheduled: ${_formatSchedule(scheduledFor!.toLocal())}'
                : 'Schedule for later',
          ),
          style: OutlinedButton.styleFrom(
            foregroundColor: isScheduled ? scheme.primary : null,
          ),
        ),
        if (isScheduled) ...[
          const SizedBox(width: 4),
          IconButton(
            tooltip: 'Clear schedule',
            visualDensity: VisualDensity.compact,
            onPressed: onClear,
            icon: const Icon(Icons.clear, size: 18),
          ),
        ],
        const Spacer(),
        TextButton(
          onPressed: onManageTap,
          style: TextButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: const Text('Manage queue'),
        ),
      ],
    );
  }
}

/// Short-form "Mon Apr 21, 3:05 PM" style used in the composer row and
/// the after-submit confirmation snackbar.
String _formatSchedule(DateTime dt) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  final hour24 = dt.hour;
  final hour = hour24 == 0 ? 12 : (hour24 > 12 ? hour24 - 12 : hour24);
  final suffix = hour24 < 12 ? 'AM' : 'PM';
  final minute = dt.minute.toString().padLeft(2, '0');
  return '${months[dt.month - 1]} ${dt.day}, $hour:$minute $suffix';
}

class _WarningToggles extends StatelessWidget {
  const _WarningToggles({
    required this.isNsfw,
    required this.isSensitive,
    required this.isGraphicNudity,
    required this.onNsfw,
    required this.onSensitive,
    required this.onGraphic,
  });

  final bool isNsfw;
  final bool isSensitive;
  final bool isGraphicNudity;
  final void Function(bool) onNsfw;
  final void Function(bool) onSensitive;
  final void Function(bool) onGraphic;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Content warnings',
            style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        SwitchListTile.adaptive(
          title: const Text('NSFW'),
          subtitle: const Text('Not safe for work'),
          value: isNsfw,
          onChanged: onNsfw,
          contentPadding: EdgeInsets.zero,
        ),
        SwitchListTile.adaptive(
          title: const Text('Sensitive'),
          subtitle: const Text('Needs age verification to view'),
          value: isSensitive,
          onChanged: onSensitive,
          contentPadding: EdgeInsets.zero,
        ),
        SwitchListTile.adaptive(
          title: const Text('Graphic nudity'),
          subtitle: const Text('Needs age verification to view'),
          value: isGraphicNudity,
          onChanged: onGraphic,
          contentPadding: EdgeInsets.zero,
        ),
      ],
    );
  }
}
