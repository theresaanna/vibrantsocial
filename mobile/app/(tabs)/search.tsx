import { useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useDebounce } from "@/hooks/use-debounce";
import { NavBar } from "@/components/nav-bar";
import { ThemedView, useUserTheme } from "@/components/themed-view";
import { useMyTheme } from "@/hooks/use-my-theme";
import { Sparklefall } from "@/components/sparklefall";

type SearchTab = "users" | "posts" | "tags";

export default function SearchScreen() {
  const { data: myTheme } = useMyTheme();

  return (
    <ThemedView themeData={myTheme}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <NavBar />
        <SearchContent />
        {myTheme?.sparklefallEnabled && myTheme.sparklefallPreset && (
          <Sparklefall preset={myTheme.sparklefallPreset} />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function SearchContent() {
  const router = useRouter();
  const theme = useUserTheme();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("users");
  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["search", activeTab, debouncedQuery],
    queryFn: () =>
      api.rpc<{ results: SearchResult[] }>(
        activeTab === "users" ? "searchUsers" :
        activeTab === "posts" ? "searchPosts" : "searchTagsForSearch",
        debouncedQuery
      ),
    enabled: debouncedQuery.length >= 2,
  });

  const results = data?.results ?? [];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <TextInput
          placeholder="Search VibrantSocial..."
          placeholderTextColor={theme.secondaryColor}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            backgroundColor: theme.containerColor + "22",
            borderRadius: 12,
            padding: 12,
            fontSize: 16,
            color: theme.textColor,
          }}
        />
      </View>

      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.secondaryColor + "33", paddingHorizontal: 16 }}>
        {(["users", "posts", "tags"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab ? theme.linkColor : "transparent",
            }}
          >
            <Text style={{ fontWeight: activeTab === tab ? "600" : "400", color: activeTab === tab ? theme.linkColor : theme.secondaryColor, textTransform: "capitalize" }}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading && debouncedQuery.length >= 2 ? (
        <View style={{ padding: 32, alignItems: "center" }}>
          <ActivityIndicator color={theme.linkColor} />
        </View>
      ) : (
        <FlashList
          data={results}
          estimatedItemSize={60}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                if (item.type === "user") router.push(`/(stack)/${item.username}`);
                else if (item.type === "post") router.push(`/(stack)/post/${item.id}`);
                else if (item.type === "tag") router.push(`/(stack)/tag/${item.title.replace(/^#/, "")}`);
              }}
              style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: theme.secondaryColor + "1a" }}
            >
              {item.avatar && (
                <Image source={{ uri: item.avatar }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "600", color: theme.textColor }}>{item.title}</Text>
                {item.subtitle && <Text style={{ color: theme.secondaryColor, fontSize: 13 }}>{item.subtitle}</Text>}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            debouncedQuery.length >= 2 ? (
              <View style={{ padding: 32, alignItems: "center" }}>
                <Text style={{ color: theme.secondaryColor }}>No results found</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

interface SearchResult {
  id: string;
  type: "user" | "post" | "tag";
  title: string;
  subtitle?: string;
  avatar?: string;
  username?: string;
}
