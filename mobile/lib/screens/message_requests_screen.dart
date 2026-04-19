import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controllers/message_requests_controller.dart';
import '../models/chat.dart';
import '../providers.dart';
import '../widgets/framed_avatar.dart';
import '../widgets/themed_background.dart';
import '../widgets/themed_container.dart';
import '../widgets/username_text.dart';
import 'conversation_screen.dart';

/// Inbox of pending incoming chat requests. Accept turns the request
/// into a real conversation and opens it; decline silently rejects.
class MessageRequestsScreen extends ConsumerWidget {
  const MessageRequestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(messageRequestsProvider);
    final viewerTheme = ref.watch(viewerThemeProvider);
    return ThemedBackground(
      theme: viewerTheme,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          title: const Text('Message requests'),
        ),
        body: RefreshIndicator(
          onRefresh: () => ref.read(messageRequestsProvider.notifier).refresh(),
          child: _body(context, ref, state),
        ),
      ),
    );
  }

  Widget _body(BuildContext context, WidgetRef ref, MessageRequestsState state) {
    if (state.requests.isEmpty) {
      if (state.isLoading) {
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
                  onPressed: () =>
                      ref.read(messageRequestsProvider.notifier).refresh(),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        );
      }
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 120),
          Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'No pending requests.',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ],
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 4),
      itemCount: state.requests.length,
      itemBuilder: (context, index) =>
          _RequestRow(request: state.requests[index]),
    );
  }
}

class _RequestRow extends ConsumerStatefulWidget {
  const _RequestRow({required this.request});

  final MessageRequest request;

  @override
  ConsumerState<_RequestRow> createState() => _RequestRowState();
}

class _RequestRowState extends ConsumerState<_RequestRow> {
  bool _busy = false;

  Future<void> _accept() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final result = await ref
          .read(messagingApiProvider)
          .acceptMessageRequest(widget.request.id);
      if (!mounted) return;
      ref.read(messageRequestsProvider.notifier).removeLocal(widget.request.id);
      ref.read(conversationListProvider.notifier).refresh();
      final convId = result.conversationId;
      if (convId != null) {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => ConversationScreen(
              conversationId: convId,
              title: widget.request.sender.label,
            ),
          ),
        );
      }
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not accept: $err')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _decline() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(messagingApiProvider)
          .declineMessageRequest(widget.request.id);
      if (!mounted) return;
      ref.read(messageRequestsProvider.notifier).removeLocal(widget.request.id);
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not decline: $err')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sender = widget.request.sender;
    final framesAsync = ref.watch(avatarFramesProvider);
    final frame = framesAsync.maybeWhen(
      data: (frames) => sender.profileFrameId == null
          ? null
          : frames[sender.profileFrameId],
      orElse: () => null,
    );
    return ThemedContainer(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          FramedAvatar(
            avatarUrl: sender.avatar,
            frame: frame,
            size: 44,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                UsernameText(
                  text: sender.label,
                  fontFamily: sender.usernameFont,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                if (sender.username != null)
                  Text(
                    '@${sender.username}',
                    style: const TextStyle(fontSize: 12),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            tooltip: 'Decline',
            icon: const Icon(Icons.close),
            onPressed: _busy ? null : _decline,
          ),
          FilledButton(
            onPressed: _busy ? null : _accept,
            child: const Text('Accept'),
          ),
        ],
      ),
    );
  }
}
