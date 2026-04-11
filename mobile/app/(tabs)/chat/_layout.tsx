import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { NavBar } from "@/components/nav-bar";
import { ThemedView } from "@/components/themed-view";
import { useMyTheme } from "@/hooks/use-my-theme";
import { Sparklefall } from "@/components/sparklefall";

export default function ChatLayout() {
  const { data: myTheme } = useMyTheme();

  return (
    <ThemedView themeData={myTheme}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <NavBar />
        <Stack>
          <Stack.Screen name="index" options={{ title: "Messages", headerShown: true }} />
          <Stack.Screen name="new" options={{ title: "New Conversation", headerShown: true }} />
          <Stack.Screen name="requests" options={{ title: "Message Requests", headerShown: true }} />
          <Stack.Screen name="[conversationId]" options={{ headerShown: true }} />
        </Stack>
        {myTheme?.sparklefallEnabled && myTheme.sparklefallPreset && (
          <Sparklefall preset={myTheme.sparklefallPreset} />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
