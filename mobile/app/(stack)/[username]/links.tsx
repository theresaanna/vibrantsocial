import { View, Text, TouchableOpacity, ActivityIndicator, Linking, ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { api } from "@/lib/api";

interface LinkEntry {
  id: string;
  title: string;
  url: string;
}

interface UserLinksData {
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatar: string | null;
  image: string | null;
  linksPageBio: string | null;
  linksPageLinks: LinkEntry[];
}

export default function UserLinksScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["userLinks", username],
    queryFn: () => api.rpc<UserLinksData | null>("getUserProfileLinks", username),
    enabled: !!username,
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#c026d3" size="large" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#9ca3af", fontSize: 16 }}>Links page not available</Text>
      </View>
    );
  }

  const displayName = data.displayName || data.name || data.username || "";
  const avatarUri = data.avatar || data.image;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#fff" }}
      contentContainerStyle={{ alignItems: "center", paddingVertical: 32, paddingHorizontal: 16 }}
    >
      {/* Avatar & Name */}
      <Image
        source={{ uri: avatarUri ?? undefined }}
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: "#e5e7eb",
          marginBottom: 12,
        }}
      />
      <Text style={{ fontSize: 20, fontWeight: "700", color: "#1f2937", marginBottom: 4 }}>
        {displayName}
      </Text>
      {data.username && (
        <Text style={{ fontSize: 14, color: "#9ca3af", marginBottom: 8 }}>
          @{data.username}
        </Text>
      )}

      {/* Bio */}
      {data.linksPageBio && (
        <Text style={{ fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 16, lineHeight: 20 }}>
          {data.linksPageBio}
        </Text>
      )}

      {/* Links */}
      <View style={{ width: "100%", maxWidth: 400, gap: 12 }}>
        {data.linksPageLinks.map((link) => (
          <TouchableOpacity
            key={link.id}
            onPress={() => Linking.openURL(link.url)}
            activeOpacity={0.7}
            style={{
              backgroundColor: "#faf5ff",
              borderWidth: 1,
              borderColor: "#e9d5ff",
              borderRadius: 16,
              padding: 16,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#7e22ce" }}>
              {link.title}
            </Text>
            <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }} numberOfLines={1}>
              {link.url}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {data.linksPageLinks.length === 0 && (
        <Text style={{ color: "#9ca3af", fontSize: 15, marginTop: 16 }}>
          No links yet
        </Text>
      )}
    </ScrollView>
  );
}
