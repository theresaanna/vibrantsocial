import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        backgroundColor: "#fff",
      }}
    >
      <Text style={{ fontSize: 64, marginBottom: 16 }}>404</Text>
      <Text style={{ fontSize: 20, fontWeight: "600", marginBottom: 8 }}>Page not found</Text>
      <Text style={{ color: "#6b7280", textAlign: "center", marginBottom: 32 }}>
        The page you're looking for doesn't exist or has been moved.
      </Text>
      <TouchableOpacity
        onPress={() => router.replace("/(tabs)")}
        style={{
          backgroundColor: "#c026d3",
          borderRadius: 12,
          paddingVertical: 14,
          paddingHorizontal: 32,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Go home</Text>
      </TouchableOpacity>
    </View>
  );
}
