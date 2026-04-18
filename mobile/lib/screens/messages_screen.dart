import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controllers/conversation_list_controller.dart';
import '../models/chat.dart';
import '../providers.dart';
import '../widgets/themed_container.dart';
import 'conversation_screen.dart';

/// List of the viewer's DM conversations. Tap a row to open the thread.
class MessagesScreen extends ConsumerWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(conversationListProvider);
    final viewerId = ref.watch(sessionProvider)?.user.id ?? '';

    return RefreshIndicator(
      onRefresh: () => ref.read(conversationListProvider.notifier).refresh(),
      child: _body(context, ref, state, viewerId),
    );
  }

  Widget _body(
    BuildContext context,
    WidgetRef ref,
    ConversationListState state,
    String viewerId,
  ) {
    if (state.conversations.isEmpty) {
      if (state.isLoading) {
        return const Center(child: CircularProgressIndicator());
      }
      if (state.error != null) {
        return _CenteredError(
          error: state.error!,
          onRetry: () => ref.read(conversationListProvider.notifier).refresh(),
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
                'No conversations yet.\nMessage a friend from their profile to start one.',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ],
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 4),
      itemCount: state.conversations.length,
      itemBuilder: (context, index) {
        final c = state.conversations[index];
        return _ConversationTile(conversation: c, viewerId: viewerId);
      },
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({required this.conversation, required this.viewerId});

  final ConversationListItem conversation;
  final String viewerId;

  @override
  Widget build(BuildContext context) {
    final avatar = conversation.displayAvatar(viewerId);
    final lastMsg = conversation.lastMessage;
    final subtitle = lastMsg == null
        ? 'No messages yet'
        : lastMsg.mediaType != null && lastMsg.content.isEmpty
            ? '[${lastMsg.mediaType}]'
            : lastMsg.content;
    return ThemedContainer(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ConversationScreen(
            conversationId: conversation.id,
            title: conversation.displayTitle(viewerId),
          ),
        ),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundImage:
                avatar != null ? CachedNetworkImageProvider(avatar) : null,
            child: avatar == null ? const Icon(Icons.person) : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  conversation.displayTitle(viewerId),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13),
                ),
              ],
            ),
          ),
          if (conversation.unreadCount > 0)
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primary,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '${conversation.unreadCount}',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onPrimary,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _CenteredError extends StatelessWidget {
  const _CenteredError({required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Could not load: $error', textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
