import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../controllers/chat_message_controller.dart';
import '../models/chat.dart';
import '../models/resolved_theme.dart';
import '../providers.dart';
import '../screens/profile_screen.dart';
import 'framed_avatar.dart';
import 'gif_picker.dart';
import 'link_preview_card.dart';
import 'linkified_text.dart';
import 'username_text.dart';

/// Payload passed from the composer to the screen when sending.
class ChatSendDraft {
  ChatSendDraft({
    required this.content,
    this.mediaUrl,
    this.mediaType,
    this.mediaFileName,
    this.mediaFileSize,
    this.replyToId,
  });

  final String content;
  final String? mediaUrl;
  final String? mediaType;
  final String? mediaFileName;
  final int? mediaFileSize;
  final String? replyToId;
}

/// Quick-reaction emoji set offered when the viewer long-presses a
/// message. Matches the web's chat-reactions toolbar.
const List<String> kQuickReactions = [
  '❤️', '😂', '😮', '😢', '👍', '🔥',
];

/// Shared thread UI used by both DM and chatroom screens. Shows messages
/// oldest→newest in a reversed ListView (so the newest is pinned to the
/// bottom), with a "load older" pull at the top and a send composer.
class ChatThreadView extends ConsumerStatefulWidget {
  const ChatThreadView({
    super.key,
    required this.viewerId,
    required this.provider,
    required this.onSend,
    this.onReact,
    this.onEdit,
    this.onDelete,
  });

  final String viewerId;
  final AutoDisposeStateNotifierProvider<ChatMessageListController, ChatMessageListState>
      provider;

  /// Returns true on success, false on failure. The thread view clears
  /// the input + dropped attachment only when true.
  final Future<bool> Function(ChatSendDraft draft) onSend;

  /// Toggle a reaction on a message. Optional — DM and chatroom screens
  /// both wire this up via the messaging / chatroom API.
  final Future<void> Function(String messageId, String emoji)? onReact;

  /// Edit own message. Required for the Edit menu item to appear.
  final Future<void> Function(String messageId, String content)? onEdit;

  /// Soft-delete own message.
  final Future<void> Function(String messageId)? onDelete;

  @override
  ConsumerState<ChatThreadView> createState() => _ChatThreadViewState();
}

class _ChatThreadViewState extends ConsumerState<ChatThreadView> {
  late final ScrollController _scrollCtrl;
  late final TextEditingController _inputCtrl;
  final ImagePicker _picker = ImagePicker();
  bool _sending = false;
  XFile? _attachment;
  String? _pendingGifUrl;
  bool _uploading = false;
  ChatMessage? _replyTarget;

  @override
  void initState() {
    super.initState();
    _scrollCtrl = ScrollController()..addListener(_onScroll);
    _inputCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _scrollCtrl.removeListener(_onScroll);
    _scrollCtrl.dispose();
    _inputCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    // Because the list is reversed, the "top" (oldest) is the largest
    // scroll offset. Load older when near that end.
    if (!_scrollCtrl.hasClients) return;
    final pos = _scrollCtrl.position;
    if (pos.pixels > pos.maxScrollExtent - 400) {
      ref.read(widget.provider.notifier).loadMore();
    }
  }

  Future<void> _pickImage() async {
    if (_uploading || _sending) return;
    try {
      final picked = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 90,
      );
      if (picked == null || !mounted) return;
      setState(() {
        _attachment = picked;
        // Image + GIF are mutually exclusive attachments — clear the
        // other so there's no ambiguity over which one gets sent.
        _pendingGifUrl = null;
      });
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not pick image: $err')),
      );
    }
  }

  Future<void> _pickGif() async {
    if (_uploading || _sending) return;
    final gif = await pickGif(context);
    if (gif == null || !mounted) return;
    setState(() {
      _pendingGifUrl = gif.url;
      _attachment = null;
    });
  }

  void _clearAttachment() {
    setState(() => _attachment = null);
  }

  void _clearGif() {
    setState(() => _pendingGifUrl = null);
  }

  void _stageReply(ChatMessage target) {
    setState(() => _replyTarget = target);
  }

  void _clearReply() {
    setState(() => _replyTarget = null);
  }

  Future<void> _handleSend() async {
    final text = _inputCtrl.text.trim();
    final attachment = _attachment;
    final gifUrl = _pendingGifUrl;
    if ((text.isEmpty && attachment == null && gifUrl == null) || _sending) {
      return;
    }
    setState(() => _sending = true);

    String? mediaUrl;
    String? mediaType;
    String? mediaFileName;
    int? mediaFileSize;
    if (attachment != null) {
      try {
        setState(() => _uploading = true);
        final upload = await ref
            .read(mediaApiProvider)
            .uploadImage(attachment.path, fileName: attachment.name);
        mediaUrl = upload.url;
        mediaType = 'image';
        mediaFileName = upload.fileName;
        mediaFileSize = upload.fileSize;
      } catch (err) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $err')),
        );
        setState(() {
          _sending = false;
          _uploading = false;
        });
        return;
      } finally {
        if (mounted) setState(() => _uploading = false);
      }
    } else if (gifUrl != null) {
      // GIFs from Giphy are pre-hosted — skip the upload pipeline and
      // attach the Giphy CDN URL directly. `mediaType: 'image'` is what
      // the server + client expect for both still images and animated
      // GIFs (Flutter's `Image.network` decodes animated GIFs natively).
      mediaUrl = gifUrl;
      mediaType = 'image';
    }

    final ok = await widget.onSend(ChatSendDraft(
      content: text,
      mediaUrl: mediaUrl,
      mediaType: mediaType,
      mediaFileName: mediaFileName,
      mediaFileSize: mediaFileSize,
      replyToId: _replyTarget?.id,
    ));
    if (!mounted) return;
    setState(() => _sending = false);
    if (ok) {
      _inputCtrl.clear();
      setState(() {
        _attachment = null;
        _pendingGifUrl = null;
        _replyTarget = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(widget.provider);
    final viewerTheme = ref.watch(viewerThemeProvider);
    return Column(
      children: [
        Expanded(child: _buildList(state, viewerTheme)),
        _Composer(
          controller: _inputCtrl,
          enabled: !_sending && !_uploading,
          sending: _sending || _uploading,
          attachment: _attachment,
          pendingGifUrl: _pendingGifUrl,
          replyTarget: _replyTarget,
          onPickImage: _pickImage,
          onPickGif: _pickGif,
          onClearAttachment: _clearAttachment,
          onClearGif: _clearGif,
          onClearReply: _clearReply,
          onSend: _handleSend,
          viewerTheme: viewerTheme,
        ),
      ],
    );
  }

  Widget _buildList(ChatMessageListState state, ResolvedTheme? viewerTheme) {
    if (state.messages.isEmpty) {
      if (state.isLoadingMore) {
        return const Center(child: CircularProgressIndicator());
      }
      if (state.error != null) {
        return Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Could not load: ${state.error}', textAlign: TextAlign.center),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () => ref.read(widget.provider.notifier).loadMore(),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        );
      }
      return const Center(child: Text('No messages yet. Say hi!'));
    }
    // Reversed index lets the newest message sit at the bottom while the
    // scroll "forward" direction climbs backward through history.
    final reversed = state.messages.reversed.toList(growable: false);
    final tail = state.isLoadingMore ? 1 : 0;
    return ListView.builder(
      controller: _scrollCtrl,
      reverse: true,
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: reversed.length + tail,
      itemBuilder: (context, index) {
        if (index >= reversed.length) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Center(child: CircularProgressIndicator()),
          );
        }
        final msg = reversed[index];
        final mine = msg.senderId == widget.viewerId;
        return _MessageBubble(
          message: msg,
          isMine: mine,
          viewerId: widget.viewerId,
          viewerTheme: viewerTheme,
          onReact: widget.onReact == null
              ? null
              : (emoji) => widget.onReact!(msg.id, emoji),
          onReply: () => _stageReply(msg),
          onEdit: mine && widget.onEdit != null
              ? (content) => widget.onEdit!(msg.id, content)
              : null,
          onDelete: mine && widget.onDelete != null
              ? () => widget.onDelete!(msg.id)
              : null,
        );
      },
    );
  }
}

class _MessageBubble extends ConsumerWidget {
  const _MessageBubble({
    required this.message,
    required this.isMine,
    required this.viewerId,
    required this.viewerTheme,
    required this.onReact,
    required this.onReply,
    required this.onEdit,
    required this.onDelete,
  });

  final ChatMessage message;
  final bool isMine;
  final String viewerId;
  final ResolvedTheme? viewerTheme;
  final Future<void> Function(String emoji)? onReact;
  final VoidCallback onReply;
  final Future<void> Function(String content)? onEdit;
  final Future<void> Function()? onDelete;

  Future<void> _showActionSheet(BuildContext context) async {
    if (message.isDeleted) return;
    final picked = await showModalBottomSheet<_BubbleAction>(
      context: context,
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (onReact != null)
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 4,
                  children: [
                    for (final emoji in kQuickReactions)
                      IconButton(
                        iconSize: 28,
                        onPressed: () =>
                            Navigator.of(context).pop(_BubbleAction.react(emoji)),
                        icon:
                            Text(emoji, style: const TextStyle(fontSize: 28)),
                      ),
                  ],
                ),
              const Divider(height: 16),
              ListTile(
                leading: const Icon(Icons.reply),
                title: const Text('Reply'),
                onTap: () =>
                    Navigator.of(context).pop(_BubbleAction.reply()),
              ),
              if (onEdit != null)
                ListTile(
                  leading: const Icon(Icons.edit_outlined),
                  title: const Text('Edit'),
                  onTap: () =>
                      Navigator.of(context).pop(_BubbleAction.edit()),
                ),
              if (onDelete != null)
                ListTile(
                  leading: const Icon(Icons.delete_outline,
                      color: Colors.redAccent),
                  title: const Text('Delete',
                      style: TextStyle(color: Colors.redAccent)),
                  onTap: () =>
                      Navigator.of(context).pop(_BubbleAction.delete()),
                ),
            ],
          ),
        ),
      ),
    );
    if (picked == null || !context.mounted) return;
    switch (picked.kind) {
      case _BubbleActionKind.reply:
        onReply();
        return;
      case _BubbleActionKind.react:
        if (onReact == null) return;
        try {
          await onReact!(picked.emoji!);
        } catch (err) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Could not react: $err')),
            );
          }
        }
        return;
      case _BubbleActionKind.edit:
        if (onEdit == null) return;
        await _runEdit(context);
        return;
      case _BubbleActionKind.delete:
        if (onDelete == null) return;
        await _runDelete(context);
        return;
    }
  }

  Future<void> _runEdit(BuildContext context) async {
    final controller = TextEditingController(text: message.content);
    final updated = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit message'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: null,
          decoration: const InputDecoration(border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (updated == null || updated.isEmpty || updated == message.content) {
      return;
    }
    try {
      await onEdit!(updated);
    } catch (err) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not edit: $err')),
        );
      }
    }
  }

  Future<void> _runDelete(BuildContext context) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete message?'),
        content: const Text('Other participants will see "[message deleted]".'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await onDelete!();
    } catch (err) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not delete: $err')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colors = viewerTheme?.colors;
    final opacity = viewerTheme?.container.opacity ?? 100;
    final containerColor = colors == null
        ? theme.colorScheme.surface
        : colors.containerColor.withValues(alpha: opacity.clamp(0, 100) / 100.0);
    final textColor = colors?.textColor ?? theme.colorScheme.onSurface;
    // Resolve the sender's frame from the cached catalog (null while
    // it loads or for users without a frame).
    final framesAsync = ref.watch(avatarFramesProvider);
    final senderFrame = framesAsync.maybeWhen(
      data: (frames) => message.sender?.profileFrameId == null
          ? null
          : frames[message.sender!.profileFrameId],
      orElse: () => null,
    );
    void openProfile() {
      final username = message.sender?.username;
      if (username == null || username.isEmpty) return;
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ProfileScreen(username: username)),
      );
    }
    // Mine bubbles get a subtle accent so they're distinguishable beyond
    // alignment alone. Falls back to the Material primary tone when no
    // theme is loaded yet.
    final mineColor = colors == null
        ? theme.colorScheme.primaryContainer
        : Color.alphaBlend(
            colors.linkColor.withValues(alpha: 0.18),
            containerColor,
          );

    final bubbleColor = isMine ? mineColor : containerColor;
    final linkColor = colors?.linkColor ?? theme.colorScheme.primary;
    final sender = message.sender;
    final showHeader = !isMine && sender != null;

    Widget body;
    if (message.isDeleted) {
      body = Text(
        '[message deleted]',
        style: TextStyle(color: textColor, fontStyle: FontStyle.italic),
      );
    } else {
      // Decide what to show beside the text. Server stores `mediaType`
      // as one of: "image", "gif", "video", "audio", "document" (see
      // src/components/chat/media-renderer.tsx). Treat "image" and "gif"
      // identically — CachedNetworkImage decodes both. Video gets a
      // thumb + play overlay; full playback lives in a later slice.
      final mt = message.mediaType;
      final hasMedia = message.mediaUrl != null;
      final attachedImage =
          hasMedia && (mt == 'image' || mt == 'gif') ? message.mediaUrl : null;
      final attachedVideo = hasMedia && mt == 'video' ? message.mediaUrl : null;
      final firstUrl = extractFirstUrlFromText(message.content);
      final inlineImageUrl = attachedImage == null &&
              attachedVideo == null &&
              firstUrl != null &&
              isImageUrl(firstUrl)
          ? firstUrl
          : null;
      final previewUrl = attachedImage == null &&
              attachedVideo == null &&
              firstUrl != null &&
              inlineImageUrl == null
          ? firstUrl
          : null;

      body = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (attachedImage != null)
            Padding(
              padding: EdgeInsets.only(
                bottom: message.content.isEmpty ? 0 : 6,
              ),
              child: _ChatImage(url: attachedImage),
            ),
          if (attachedVideo != null)
            Padding(
              padding: EdgeInsets.only(
                bottom: message.content.isEmpty ? 0 : 6,
              ),
              child: _ChatVideoThumb(
                url: attachedVideo,
                thumbUrl: message.mediaThumbUrl,
              ),
            ),
          if (message.content.isNotEmpty)
            LinkifiedText(
              text: message.content,
              baseStyle: TextStyle(color: textColor),
              linkColor: linkColor,
            ),
          if (inlineImageUrl != null)
            Padding(
              padding: EdgeInsets.only(
                top: message.content.isEmpty ? 0 : 6,
              ),
              child: _ChatImage(url: inlineImageUrl),
            ),
          if (previewUrl != null)
            LinkPreviewCard(
              url: previewUrl,
              textColor: textColor,
              borderColor: textColor,
            ),
        ],
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
      child: Row(
        mainAxisAlignment: isMine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMine)
            GestureDetector(
              onTap: openProfile,
              child: FramedAvatar(
                avatarUrl: sender?.avatar,
                frame: senderFrame,
                size: 32,
              ),
            ),
          if (!isMine) const SizedBox(width: 8),
          Flexible(
            child: Column(
              crossAxisAlignment:
                  isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                if (showHeader)
                  GestureDetector(
                    onTap: openProfile,
                    child: Padding(
                      padding: const EdgeInsets.only(left: 4, bottom: 2),
                      child: UsernameText(
                        text: sender.label,
                        fontFamily: sender.usernameFont,
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: textColor.withValues(alpha: 0.7),
                        ),
                      ),
                    ),
                  ),
                GestureDetector(
                  onLongPress: () => _showActionSheet(context),
                  child: Material(
                    color: bubbleColor,
                    borderRadius: BorderRadius.circular(16),
                    clipBehavior: Clip.antiAlias,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      child: ConstrainedBox(
                        constraints: BoxConstraints(
                          maxWidth: MediaQuery.of(context).size.width * 0.72,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (message.replyTo != null)
                              _ReplyQuote(
                                replyTo: message.replyTo!,
                                textColor: textColor,
                                linkColor: linkColor,
                              ),
                            if (message.replyTo != null)
                              const SizedBox(height: 6),
                            body,
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                if (message.reactions.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: _ReactionRow(
                      reactions: message.reactions,
                      viewerId: viewerId,
                      linkColor: linkColor,
                      onTap: onReact,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Discriminated union for bottom-sheet actions.
enum _BubbleActionKind { react, reply, edit, delete }

class _BubbleAction {
  _BubbleAction._(this.kind, this.emoji);
  factory _BubbleAction.react(String emoji) =>
      _BubbleAction._(_BubbleActionKind.react, emoji);
  factory _BubbleAction.reply() => _BubbleAction._(_BubbleActionKind.reply, null);
  factory _BubbleAction.edit() => _BubbleAction._(_BubbleActionKind.edit, null);
  factory _BubbleAction.delete() =>
      _BubbleAction._(_BubbleActionKind.delete, null);

  final _BubbleActionKind kind;
  final String? emoji;
}

/// "Replying to {name}: {content}" quote rendered inside a bubble whose
/// underlying message has a `replyTo`.
class _ReplyQuote extends StatelessWidget {
  const _ReplyQuote({
    required this.replyTo,
    required this.textColor,
    required this.linkColor,
  });

  final MessageReplyTo replyTo;
  final Color textColor;
  final Color linkColor;

  @override
  Widget build(BuildContext context) {
    final preview = replyTo.deletedAt != null
        ? '[deleted]'
        : (replyTo.content.isEmpty ? '[media]' : replyTo.content);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        border: Border(left: BorderSide(color: linkColor, width: 3)),
        color: linkColor.withValues(alpha: 0.06),
        borderRadius: const BorderRadius.only(
          topRight: Radius.circular(6),
          bottomRight: Radius.circular(6),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          UsernameText(
            text: replyTo.senderName,
            fontFamily: replyTo.senderUsernameFont,
            style: TextStyle(
              color: linkColor,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            preview,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: textColor.withValues(alpha: 0.8),
              fontSize: 12,
              fontStyle: replyTo.deletedAt != null
                  ? FontStyle.italic
                  : FontStyle.normal,
            ),
          ),
        ],
      ),
    );
  }
}

/// Strip of reaction chips below a bubble. Tapping a chip toggles the
/// viewer's own reaction with that emoji.
class _ReactionRow extends StatelessWidget {
  const _ReactionRow({
    required this.reactions,
    required this.viewerId,
    required this.linkColor,
    required this.onTap,
  });

  final List<ReactionGroup> reactions;
  final String viewerId;
  final Color linkColor;
  final Future<void> Function(String emoji)? onTap;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 4,
      runSpacing: 4,
      children: [
        for (final r in reactions)
          _ReactionChip(
            emoji: r.emoji,
            count: r.count,
            mine: r.reactedBy(viewerId),
            linkColor: linkColor,
            onTap: onTap == null ? null : () => onTap!(r.emoji),
          ),
      ],
    );
  }
}

class _ReactionChip extends StatelessWidget {
  const _ReactionChip({
    required this.emoji,
    required this.count,
    required this.mine,
    required this.linkColor,
    required this.onTap,
  });

  final String emoji;
  final int count;
  final bool mine;
  final Color linkColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final bg = mine
        ? linkColor.withValues(alpha: 0.18)
        : Colors.black12.withValues(alpha: 0.08);
    final border = mine ? linkColor.withValues(alpha: 0.55) : Colors.transparent;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: border, width: 1),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 13)),
            if (count > 1) ...[
              const SizedBox(width: 4),
              Text(
                '$count',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Inline image used for attached media and image-URL previews. Tap
/// opens the original in the system browser. Capped to roughly the
/// web app's `max-h-[400px] max-w-[300px]`.
class _ChatImage extends StatelessWidget {
  const _ChatImage({required this.url});

  final String url;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: GestureDetector(
        onTap: () async {
          final uri = Uri.tryParse(url);
          if (uri != null) {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
          }
        },
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 240, maxHeight: 320),
          child: CachedNetworkImage(
            imageUrl: url,
            fit: BoxFit.cover,
            placeholder: (_, _) => const SizedBox(
              width: 80,
              height: 80,
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            ),
            errorWidget: (_, _, _) => const SizedBox.shrink(),
          ),
        ),
      ),
    );
  }
}

/// Video attachment placeholder. Shows the server-supplied thumbnail
/// (when present) with a play overlay. Tap opens the video in the
/// system browser — full in-app playback is a follow-up.
class _ChatVideoThumb extends StatelessWidget {
  const _ChatVideoThumb({required this.url, required this.thumbUrl});

  final String url;
  final String? thumbUrl;

  @override
  Widget build(BuildContext context) {
    final t = thumbUrl;
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: GestureDetector(
        onTap: () async {
          final uri = Uri.tryParse(url);
          if (uri != null) {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
          }
        },
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 240, maxHeight: 320),
          child: Stack(
            alignment: Alignment.center,
            children: [
              if (t != null && t.isNotEmpty)
                CachedNetworkImage(
                  imageUrl: t,
                  fit: BoxFit.cover,
                  width: 240,
                  height: 180,
                  errorWidget: (_, _, _) => Container(
                    width: 240,
                    height: 180,
                    color: Colors.black54,
                  ),
                )
              else
                Container(width: 240, height: 180, color: Colors.black54),
              const DecoratedBox(
                decoration: BoxDecoration(
                  color: Colors.black54,
                  shape: BoxShape.circle,
                ),
                child: Padding(
                  padding: EdgeInsets.all(12),
                  child: Icon(Icons.play_arrow, color: Colors.white, size: 32),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.enabled,
    required this.sending,
    required this.attachment,
    required this.pendingGifUrl,
    required this.replyTarget,
    required this.onPickImage,
    required this.onPickGif,
    required this.onClearAttachment,
    required this.onClearGif,
    required this.onClearReply,
    required this.onSend,
    required this.viewerTheme,
  });

  final TextEditingController controller;
  final bool enabled;
  final bool sending;
  final XFile? attachment;
  final String? pendingGifUrl;
  final ChatMessage? replyTarget;
  final VoidCallback onPickImage;
  final VoidCallback onPickGif;
  final VoidCallback onClearAttachment;
  final VoidCallback onClearGif;
  final VoidCallback onClearReply;
  final VoidCallback onSend;
  final ResolvedTheme? viewerTheme;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = viewerTheme?.colors;
    final opacity = viewerTheme?.container.opacity ?? 100;
    final containerColor = colors == null
        ? theme.colorScheme.surface
        : colors.containerColor.withValues(alpha: opacity.clamp(0, 100) / 100.0);
    final textColor = colors?.textColor ?? theme.colorScheme.onSurface;

    return Material(
      color: containerColor,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (replyTarget != null)
                Padding(
                  padding: const EdgeInsets.only(left: 4, right: 4, bottom: 6),
                  child: _ReplyStagedChip(
                    target: replyTarget!,
                    textColor: textColor,
                    onClear: onClearReply,
                  ),
                ),
              if (attachment != null)
                Padding(
                  padding: const EdgeInsets.only(left: 4, bottom: 6, top: 2),
                  child: _AttachmentPreview(
                    file: attachment!,
                    onRemove: sending ? null : onClearAttachment,
                  ),
                ),
              if (pendingGifUrl != null)
                Padding(
                  padding: const EdgeInsets.only(left: 4, bottom: 6, top: 2),
                  child: _GifPreview(
                    url: pendingGifUrl!,
                    onRemove: sending ? null : onClearGif,
                  ),
                ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  IconButton(
                    tooltip: 'Attach image',
                    onPressed: enabled ? onPickImage : null,
                    icon: const Icon(Icons.image_outlined),
                    color: textColor,
                  ),
                  IconButton(
                    tooltip: 'Add GIF',
                    onPressed: enabled ? onPickGif : null,
                    icon: const Icon(Icons.gif_box_outlined),
                    color: textColor,
                  ),
                  Expanded(
                    child: TextField(
                      controller: controller,
                      minLines: 1,
                      maxLines: 5,
                      enabled: enabled,
                      style: TextStyle(color: textColor),
                      textInputAction: TextInputAction.newline,
                      decoration: InputDecoration(
                        hintText: 'Message',
                        hintStyle:
                            TextStyle(color: textColor.withValues(alpha: 0.5)),
                        border: const OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: sending ? null : onSend,
                    icon: sending
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// "Replying to {name}: {preview}" chip rendered above the composer
/// while a reply is staged. The X clears the reply target without
/// sending.
class _ReplyStagedChip extends StatelessWidget {
  const _ReplyStagedChip({
    required this.target,
    required this.textColor,
    required this.onClear,
  });

  final ChatMessage target;
  final Color textColor;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final senderLabel = target.sender?.label ?? 'message';
    final senderFont = target.sender?.usernameFont;
    final preview = target.isDeleted
        ? '[deleted]'
        : target.content.isEmpty
            ? '[media]'
            : target.content;
    final headerStyle = TextStyle(
      color: textColor.withValues(alpha: 0.7),
      fontSize: 11,
      fontWeight: FontWeight.w600,
    );
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: textColor.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(Icons.reply, size: 14, color: textColor.withValues(alpha: 0.7)),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text('Replying to ', style: headerStyle),
                    Flexible(
                      child: UsernameText(
                        text: senderLabel,
                        fontFamily: senderFont,
                        style: headerStyle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                Text(
                  preview,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: textColor.withValues(alpha: 0.85),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          InkWell(
            onTap: onClear,
            customBorder: const CircleBorder(),
            child: Padding(
              padding: const EdgeInsets.all(4),
              child: Icon(Icons.close,
                  size: 16, color: textColor.withValues(alpha: 0.7)),
            ),
          ),
        ],
      ),
    );
  }
}

/// Inline preview chip for the picked-but-not-yet-sent image. The X
/// button drops the attachment without sending.
/// Sibling of `_AttachmentPreview` for GIFs picked from Giphy. Renders
/// the remote URL via `Image.network` so the animation loops even
/// before send.
class _GifPreview extends StatelessWidget {
  const _GifPreview({required this.url, required this.onRemove});

  final String url;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.network(
            url,
            height: 80,
            fit: BoxFit.cover,
          ),
        ),
        if (onRemove != null)
          Positioned(
            top: -6,
            right: -6,
            child: Material(
              color: Colors.black87,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onRemove,
                child: const Padding(
                  padding: EdgeInsets.all(2),
                  child: Icon(Icons.close, size: 14, color: Colors.white),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _AttachmentPreview extends StatelessWidget {
  const _AttachmentPreview({required this.file, required this.onRemove});

  final XFile file;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.file(
            File(file.path),
            width: 80,
            height: 80,
            fit: BoxFit.cover,
          ),
        ),
        if (onRemove != null)
          Positioned(
            top: -6,
            right: -6,
            child: Material(
              color: Colors.black87,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onRemove,
                child: const Padding(
                  padding: EdgeInsets.all(2),
                  child: Icon(Icons.close, size: 14, color: Colors.white),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
