import { Stack } from "expo-router";

export default function ChatLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Messages", headerShown: false }} />
      <Stack.Screen name="new" options={{ title: "New Conversation", headerShown: false }} />
      <Stack.Screen name="requests" options={{ title: "Message Requests", headerShown: false }} />
      <Stack.Screen name="[conversationId]" options={{ headerShown: false }} />
    </Stack>
  );
}
