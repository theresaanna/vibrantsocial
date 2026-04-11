import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { api } from "@/lib/api";
import { Avatar } from "@/components/avatar";
import { formatDistanceToNow } from "@/lib/date";
import { MarketplaceQA } from "@/components/marketplace-qa";
import { DigitalFileDownload } from "@/components/digital-file-download";
import { useAuth } from "@/lib/auth-context";

const SCREEN_WIDTH = Dimensions.get("window").width;

interface MarketplaceDetail {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  condition: string;
  createdAt: string;
  marketplacePostId: string;
  media: { url: string; type: string }[];
  author: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
    profileFrameId: string | null;
  };
  digitalFile?: {
    hasFile: boolean;
    fileName?: string;
    fileSize?: number;
    isFree?: boolean;
    downloadCount?: number;
    isOwner?: boolean;
  };
}

export default function MarketplaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: item, isLoading } = useQuery({
    queryKey: ["marketplacePost", id],
    queryFn: () => api.rpc<MarketplaceDetail>("fetchMarketplacePost", id),
  });

  if (isLoading || !item) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#c026d3" />
      </View>
    );
  }

  const formattedPrice = `${item.currency === "USD" ? "$" : item.currency}${(item.price / 100).toFixed(2)}`;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Image gallery */}
      {item.media.length > 0 && (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {item.media.map((m, i) => (
            <Image
              key={i}
              source={{ uri: m.url }}
              style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH }}
              contentFit="cover"
            />
          ))}
        </ScrollView>
      )}

      {/* Title and price */}
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: "#1f2937" }}>
          {item.title}
        </Text>
        <Text style={{ fontSize: 24, fontWeight: "700", color: "#c026d3", marginTop: 4 }}>
          {formattedPrice}
        </Text>
        {item.condition && (
          <View
            style={{
              backgroundColor: "#f3f4f6",
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 4,
              alignSelf: "flex-start",
              marginTop: 8,
            }}
          >
            <Text style={{ fontSize: 13, color: "#6b7280" }}>{item.condition}</Text>
          </View>
        )}
        <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 8 }}>
          Listed {formatDistanceToNow(new Date(item.createdAt))} ago
        </Text>
      </View>

      {/* Digital file download */}
      {item.digitalFile?.hasFile && item.digitalFile.fileName && (
        <DigitalFileDownload
          marketplacePostId={item.marketplacePostId}
          fileName={item.digitalFile.fileName}
          fileSize={item.digitalFile.fileSize ?? 0}
          isFree={item.digitalFile.isFree ?? true}
          isOwner={item.digitalFile.isOwner ?? false}
          downloadCount={item.digitalFile.downloadCount}
        />
      )}

      {/* Description */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ fontWeight: "600", fontSize: 16, marginBottom: 8 }}>Description</Text>
        <Text style={{ fontSize: 15, lineHeight: 22, color: "#4b5563" }}>
          {item.description}
        </Text>
      </View>

      {/* Seller info */}
      <TouchableOpacity
        onPress={() => item.author.username && router.push(`/(stack)/${item.author.username}`)}
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 16,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: "#e5e7eb",
        }}
      >
        <Avatar uri={item.author.avatar} size={44} frameId={item.author.profileFrameId} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontWeight: "600", fontSize: 15 }}>
            {item.author.displayName || item.author.username}
          </Text>
          {item.author.username && (
            <Text style={{ color: "#9ca3af", fontSize: 13 }}>@{item.author.username}</Text>
          )}
        </View>
        <Text style={{ color: "#9ca3af", fontSize: 13 }}>Seller</Text>
      </TouchableOpacity>

      {/* Q&A Section */}
      <MarketplaceQA
        marketplacePostId={item.marketplacePostId}
        postAuthorId={item.author.id}
        currentUserId={user?.id}
      />

      {/* Contact seller button */}
      <View style={{ padding: 16, paddingBottom: 32 }}>
        <TouchableOpacity
          style={{
            backgroundColor: "#c026d3",
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
            Contact Seller
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
