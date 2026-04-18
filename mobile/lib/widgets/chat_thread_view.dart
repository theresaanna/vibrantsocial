import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../controllers/chat_message_controller.dart';
import '../models/chat.dart';
import '../models/resolved_theme.dart';
import '../providers.dart';
import 'link_preview_card.dart';
import 'linkified_text.dart';

/// Shared thread UI used by both DM and chatroom screens. Shows messages
/// oldest→newest in a reversed ListView (so the newest is pinned to the
/// bottom), with a "load older" pull at the top and a send composer.
class ChatThreadView extends ConsumerStatefulWidget {
  const ChatThreadView({
    super.key,
    required this.viewerId,
    required this.provider,
    required this.onSend,
  });

  final String viewerId;
  final AutoDisposeStateNotifierProvider<ChatMessageListController, ChatMessageListState>
      provider;

  /// Returns true on success, false on failure. The thread view clears
  /// the input only when true.
  final Future<bool> Function(String content) onSend;

  @override
  ConsumerState<ChatThreadView> createState() => _ChatThreadViewState();
}

class _ChatThreadViewState extends ConsumerState<ChatThreadView> {
  late final ScrollController _scrollCtrl;
  late final TextEditingController _inputCtrl;
  bool _sending = false;

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

  Future<void> _handleSend() async {
    final text = _inputCtrl.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    final ok = await widget.onSend(text);
    if (!mounted) return;
    setState(() => _sending = false);
    if (ok) {
      _inputCtrl.clear();
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
          enabled: !_sending,
          sending: _sending,
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
        return _MessageBubble(
          message: msg,
          isMine: msg.senderId == widget.viewerId,
          viewerTheme: viewerTheme,
        );
      },
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.isMine,
    required this.viewerTheme,
  });

  final ChatMessage message;
  final bool isMine;
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
            CircleAvatar(
              radius: 14,
              backgroundImage: sender?.avatar != null
                  ? CachedNetworkImageProvider(sender!.avatar!)
                  : null,
              child: sender?.avatar == null
                  ? const Icon(Icons.person, size: 16)
                  : null,
            ),
          if (!isMine) const SizedBox(width: 8),
          Flexible(
            child: Column(
              crossAxisAlignment:
                  isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                if (showHeader)
                  Padding(
                    padding: const EdgeInsets.only(left: 4, bottom: 2),
                    child: Text(
                      sender.label,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: textColor.withValues(alpha: 0.7),
                      ),
                    ),
                  ),
                Material(
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
                      child: body,
                    ),
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
    required this.onSend,
    required this.viewerTheme,
  });

  final TextEditingController controller;
  final bool enabled;
  final bool sending;
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
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
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
        ),
      ),
    );
  }
}
