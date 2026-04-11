import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Dimensions } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { api } from "@/lib/api";
import { useDebounce } from "@/hooks/use-debounce";

interface MarketplacePost {
  id: string;
  title: string;
  price: number;
  currency: string;
  media: { url: string; type: string }[];
  author: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  };
}

const COLUMN_COUNT = 2;
const SCREEN_WIDTH = Dimensions.get("window").width;
const ITEM_GAP = 12;
const HORIZONTAL_PADDING = 16;
const ITEM_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - ITEM_GAP) / COLUMN_COUNT;

export default function MarketplaceScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["marketplace", debouncedQuery],
    queryFn: () =>
      api.rpc<{ posts: MarketplacePost[] }>("searchMarketplacePosts", debouncedQuery),
  });

  const posts = data?.posts ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <TextInput
          placeholder="Search marketplace..."
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            backgroundColor: "#f3f4f6",
            borderRadius: 12,
            padding: 12,
            fontSize: 16,
          }}
        />
      </View>

      {/* Create Listing FAB */}
      <TouchableOpacity
        onPress={() => router.push("/(stack)/marketplace/create")}
        activeOpacity={0.8}
        style={{
          position: "absolute",
          bottom: 24,
          right: 20,
          zIndex: 10,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: "#c026d3",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 6,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 28, fontWeight: "300", marginTop: -2 }}>+</Text>
      </TouchableOpacity>

      {isLoading ? (
        <View style={{ padding: 32, alignItems: "center" }}>
          <ActivityIndicator color="#c026d3" />
        </View>
      ) : (
        <FlashList
          data={posts}
          numColumns={COLUMN_COUNT}
          estimatedItemSize={220}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PADDING }}
          renderItem={({ item, index }) => {
            const isLeftColumn = index % 2 === 0;
            return (
              <TouchableOpacity
                onPress={() => router.push(`/(stack)/marketplace/${item.id}`)}
                activeOpacity={0.7}
                style={{
                  width: ITEM_WIDTH,
                  marginRight: isLeftColumn ? ITEM_GAP : 0,
                  marginBottom: ITEM_GAP,
                }}
              >
                <Image
                  source={{ uri: item.media?.[0]?.url }}
                  style={{
                    width: "100%",
                    aspectRatio: 1,
                    borderRadius: 12,
                    backgroundColor: "#f3f4f6",
                  }}
                  contentFit="cover"
                />
                <Text
                  numberOfLines={2}
                  style={{ fontWeight: "600", fontSize: 14, marginTop: 6, color: "#1f2937" }}
                >
                  {item.title}
                </Text>
                <Text style={{ color: "#c026d3", fontWeight: "700", fontSize: 15, marginTop: 2 }}>
                  {item.currency === "USD" ? "$" : item.currency}
                  {(item.price / 100).toFixed(2)}
                </Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: "center" }}>
              <Text style={{ color: "#9ca3af", fontSize: 15 }}>No listings found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
