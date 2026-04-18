import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import '../services/ably_service.dart';
import '../widgets/chat_thread_view.dart';
import '../widgets/themed_background.dart';

/// A 1:1 or group DM thread. Loads paginated history on first open,
/// subscribes to the `chat:{id}` Ably channel for live additions, and
/// marks the conversation read when it's displayed.
class ConversationScreen extends ConsumerStatefulWidget {
  const ConversationScreen({
    super.key,
    required this.conversationId,
    required this.title,
  });

  final String conversationId;
  final String title;

  @override
  ConsumerState<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends ConsumerState<ConversationScreen> {
  ChatChannelSubscription? _sub;

  @override
  void initState() {
    super.initState();
    // Subscribe to realtime updates. The service sets up the Ably client
    // lazily the first time we subscribe.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final ctrl = ref.read(conversationMessagesProvider(widget.conversationId).notifier);
      _sub = ref.read(ablyServiceProvider).subscribeConversation(
            widget.conversationId,
            onNew: ctrl.appendLive,
            onEdit: ctrl.applyEdit,
            onDelete: ctrl.applyDelete,
          );
      // Mark read asynchronously — we don't block the UI on it.
      ref.read(messagingApiProvider).markConversationRead(widget.conversationId);
    });
  }

  @override
  void dispose() {
    _sub?.close();
    super.dispose();
  }

  Future<bool> _send(String content) async {
    final api = ref.read(messagingApiProvider);
    try {
      final result = await api.sendMessage(
        conversationId: widget.conversationId,
        content: content,
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
          provider: conversationMessagesProvider(widget.conversationId),
          onSend: _send,
        ),
      ),
    );
  }
}
