import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controllers/chatroom_list_controller.dart';
import '../models/chat.dart';
import '../providers.dart';
import '../widgets/themed_container.dart';
import 'chatroom_screen.dart';

/// Browsable list of public chatrooms. Taps open the room thread.
class ChatroomsScreen extends ConsumerWidget {
  const ChatroomsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(chatroomListProvider);
    return RefreshIndicator(
      onRefresh: () => ref.read(chatroomListProvider.notifier).refresh(),
      child: _body(context, ref, state),
    );
  }

  Widget _body(BuildContext context, WidgetRef ref, ChatroomListState state) {
    if (state.rooms.isEmpty) {
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
                      ref.read(chatroomListProvider.notifier).refresh(),
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
              child: Text('No chatrooms available.', textAlign: TextAlign.center),
            ),
          ),
        ],
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 4),
      itemCount: state.rooms.length,
      itemBuilder: (context, index) {
        final room = state.rooms[index];
        return _RoomTile(room: room);
      },
    );
  }
}

class _RoomTile extends StatelessWidget {
  const _RoomTile({required this.room});

  final ChatRoomListItem room;

  @override
  Widget build(BuildContext context) {
    final subtitle = room.status ??
        (room.messageCount == 0 ? 'No messages yet' : '${room.messageCount} messages');
    return ThemedContainer(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ChatroomScreen(slug: room.slug, title: room.name),
        ),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            child: Text(room.name.isNotEmpty ? room.name[0].toUpperCase() : '#'),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        room.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                    if (room.isNsfw) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.red.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text(
                          'NSFW',
                          style: TextStyle(
                            color: Colors.redAccent,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ],
                  ],
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
        ],
      ),
    );
  }
}
