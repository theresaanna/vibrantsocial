import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import '../services/ably_service.dart';
import '../widgets/chat_thread_view.dart';
import '../widgets/themed_background.dart';

/// A public chatroom thread (e.g. `lobby`). Same thread UX as a DM, but
/// subscribes to the `chatroom:{slug}` Ably channel instead.
class ChatroomScreen extends ConsumerStatefulWidget {
  const ChatroomScreen({super.key, required this.slug, required this.title});

  final String slug;
  final String title;

  @override
  ConsumerState<ChatroomScreen> createState() => _ChatroomScreenState();
}

class _ChatroomScreenState extends ConsumerState<ChatroomScreen> {
  ChatChannelSubscription? _sub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final ctrl = ref.read(chatroomMessagesProvider(widget.slug).notifier);
      _sub = ref.read(ablyServiceProvider).subscribeRoom(
            widget.slug,
            onNew: ctrl.appendLive,
            onEdit: ctrl.applyEdit,
            onDelete: ctrl.applyDelete,
            onReaction: ctrl.applyReactions,
            // Async moderation flagged this message NSFW after it had
            // already been delivered via realtime — remove it from the
            // local list so Play-policy holds even mid-room.
            onNsfwRedaction: ctrl.applyRedaction,
          );
    });
  }

  @override
  void dispose() {
    _sub?.close();
    super.dispose();
  }

  Future<bool> _send(ChatSendDraft draft) async {
    try {
      final result = await ref.read(chatroomApiProvider).sendMessage(
            slug: widget.slug,
            content: draft.content,
            mediaUrl: draft.mediaUrl,
            mediaType: draft.mediaType,
            mediaFileName: draft.mediaFileName,
            mediaFileSize: draft.mediaFileSize,
          );
      if (!result.success) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(result.message)),
          );
        }
        return false;
      }
      return true;
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to send: $err')),
        );
      }
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewerTheme = ref.watch(viewerThemeProvider);
    return ThemedBackground(
      theme: viewerTheme,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          title: Text(widget.title),
        ),
        body: ChatThreadView(
          viewerId: ref.watch(sessionProvider)?.user.id ?? '',
          provider: chatroomMessagesProvider(widget.slug),
          onSend: _send,
          onReact: (id, emoji) => ref
              .read(chatroomApiProvider)
              .toggleReaction(messageId: id, emoji: emoji),
          onEdit: (id, content) => ref
              .read(chatroomApiProvider)
              .editMessage(messageId: id, content: content),
          onDelete: (id) =>
              ref.read(chatroomApiProvider).deleteMessage(id),
        ),
      ),
    );
  }
}
