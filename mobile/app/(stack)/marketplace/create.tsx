import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { api } from "@/lib/api";

const CATEGORIES = [
  "Art",
  "Clothing",
  "Collectibles",
  "Digital",
  "Electronics",
  "Handmade",
  "Home",
  "Jewelry",
  "Music",
  "Photography",
  "Services",
  "Other",
];

const CONDITIONS = ["New", "Like New", "Good", "Fair", "Poor"];

export default function CreateListingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("New");
  const [tags, setTags] = useState("");
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [digitalFile, setDigitalFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [isDigital, setIsDigital] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showConditionPicker, setShowConditionPicker] = useState(false);

  const createListing = useMutation({
    mutationFn: async () => {
      // Upload images first
      const uploadedMedia: { url: string; type: string }[] = [];
      for (const img of images) {
        const result = await api.upload({
          uri: img.uri,
          name: img.fileName ?? `image-${Date.now()}.jpg`,
          type: img.mimeType ?? "image/jpeg",
        });
        uploadedMedia.push({ url: result.url, type: "image" });
      }

      // Upload digital file if present
      let digitalFileData = undefined;
      if (isDigital && digitalFile) {
        const result = await api.upload({
          uri: digitalFile.uri,
          name: digitalFile.name,
          type: digitalFile.mimeType ?? "application/octet-stream",
        });
        digitalFileData = {
          url: result.url,
          fileName: digitalFile.name,
          fileSize: digitalFile.size ?? 0,
          isFree: true,
        };
      }

      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      return api.rpc("createMarketplaceListing", {
        title: title.trim(),
        description: description.trim(),
        price: Math.round(parseFloat(price) * 100),
        currency: "USD",
        category,
        condition,
        tags: tagList,
        media: uploadedMedia,
        digitalFile: digitalFileData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace"] });
      router.back();
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to create listing");
    },
  });

  async function pickImages() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10 - images.length,
    });

    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets]);
    }
  }

  async function pickDigitalFile() {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      setDigitalFile(result.assets[0]);
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  const isValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    parseFloat(price) > 0 &&
    category.length > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={{ padding: 16, gap: 20 }}>
          {/* Images */}
          <View>
            <Text style={{ fontSize: 15, fontWeight: "600", marginBottom: 8, color: "#1f2937" }}>
              Photos
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {images.map((img, i) => (
                  <TouchableOpacity key={i} onPress={() => removeImage(i)}>
                    <Image
                      source={{ uri: img.uri }}
                      style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: "#f3f4f6" }}
                      contentFit="cover"
                    />
                    <View
                      style={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        backgroundColor: "rgba(0,0,0,0.6)",
                        borderRadius: 10,
                        width: 20,
                        height: 20,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>x</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {images.length < 10 && (
                  <TouchableOpacity
                    onPress={pickImages}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: "#e5e7eb",
                      borderStyle: "dashed",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 24, color: "#9ca3af" }}>+</Text>
                    <Text style={{ fontSize: 10, color: "#9ca3af" }}>Add photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>

          {/* Title */}
          <View>
            <Text style={{ fontSize: 15, fontWeight: "600", marginBottom: 6, color: "#1f2937" }}>
              Title *
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What are you selling?"
              maxLength={200}
              style={{
                backgroundColor: "#f3f4f6",
                borderRadius: 10,
                padding: 12,
                fontSize: 16,
              }}
            />
          </View>

          {/* Description */}
          <View>
            <Text style={{ fontSize: 15, fontWeight: "600", marginBottom: 6, color: "#1f2937" }}>
              Description *
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your item in detail..."
              multiline
              numberOfLines={4}
              maxLength={5000}
              textAlignVertical="top"
              style={{
                backgroundColor: "#f3f4f6",
                borderRadius: 10,
                padding: 12,
                fontSize: 16,
                minHeight: 100,
              }}
            />
          </View>

          {/* Price */}
          <View>
            <Text style={{ fontSize: 15, fontWeight: "600", marginBottom: 6, color: "#1f2937" }}>
              Price (USD) *
            </Text>
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              keyboardType="decimal-pad"
              style={{
                backgroundColor: "#f3f4f6",
                borderRadius: 10,
                padding: 12,
                fontSize: 16,
              }}
            />
          </View>

          {/* Category */}
          <View>
            <Text style={{ fontSize: 15, fontWeight: "600", marginBottom: 6, color: "#1f2937" }}>
              Category *
            </Text>
            <TouchableOpacity
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              style={{
                backgroundColor: "#f3f4f6",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <Text style={{ fontSize: 16, color: category ? "#1f2937" : "#9ca3af" }}>
                {category || "Select a category"}
              </Text>
            </TouchableOpacity>
            {showCategoryPicker && (
              <View
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  marginTop: 4,
                  overflow: "hidden",
                }}
              >
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => {
                      setCategory(cat);
                      setShowCategoryPicker(false);
                    }}
                    style={{
                      padding: 12,
                      backgroundColor: category === cat ? "#faf5ff" : "#fff",
                      borderBottomWidth: 1,
                      borderBottomColor: "#f3f4f6",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        color: category === cat ? "#c026d3" : "#1f2937",
                        fontWeight: category === cat ? "600" : "400",
                      }}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Condition */}
          <View>
            <Text style={{ fontSize: 15, fontWeight: "600", marginBottom: 6, color: "#1f2937" }}>
              Condition
            </Text>
            <TouchableOpacity
              onPress={() => setShowConditionPicker(!showConditionPicker)}
              style={{
                backgroundColor: "#f3f4f6",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <Text style={{ fontSize: 16, color: "#1f2937" }}>{condition}</Text>
            </TouchableOpacity>
            {showConditionPicker && (
              <View
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  marginTop: 4,
                  overflow: "hidden",
                }}
              >
                {CONDITIONS.map((cond) => (
                  <TouchableOpacity
                    key={cond}
                    onPress={() => {
                      setCondition(cond);
                      setShowConditionPicker(false);
                    }}
                    style={{
                      padding: 12,
                      backgroundColor: condition === cond ? "#faf5ff" : "#fff",
                      borderBottomWidth: 1,
                      borderBottomColor: "#f3f4f6",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        color: condition === cond ? "#c026d3" : "#1f2937",
                        fontWeight: condition === cond ? "600" : "400",
                      }}
                    >
                      {cond}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Tags */}
          <View>
            <Text style={{ fontSize: 15, fontWeight: "600", marginBottom: 6, color: "#1f2937" }}>
              Tags
            </Text>
            <TextInput
              value={tags}
              onChangeText={setTags}
              placeholder="art, handmade, vintage (comma separated)"
              style={{
                backgroundColor: "#f3f4f6",
                borderRadius: 10,
                padding: 12,
                fontSize: 16,
              }}
            />
          </View>

          {/* Digital file toggle */}
          <TouchableOpacity
            onPress={() => setIsDigital(!isDigital)}
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                borderWidth: 2,
                borderColor: isDigital ? "#c026d3" : "#d1d5db",
                backgroundColor: isDigital ? "#c026d3" : "#fff",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isDigital && (
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
                  {"\u2713"}
                </Text>
              )}
            </View>
            <Text style={{ fontSize: 15, color: "#1f2937" }}>
              Include digital file for download
            </Text>
          </TouchableOpacity>

          {/* Digital file picker */}
          {isDigital && (
            <View>
              {digitalFile ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#faf5ff",
                    borderRadius: 10,
                    padding: 12,
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 14, fontWeight: "600", color: "#c026d3" }}
                    >
                      {digitalFile.name}
                    </Text>
                    {digitalFile.size != null && (
                      <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                        {formatFileSize(digitalFile.size)}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => setDigitalFile(null)}>
                    <Text style={{ color: "#ef4444", fontWeight: "600" }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={pickDigitalFile}
                  style={{
                    borderWidth: 2,
                    borderColor: "#e5e7eb",
                    borderStyle: "dashed",
                    borderRadius: 10,
                    padding: 16,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 14, color: "#9ca3af" }}>Tap to select a file</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            onPress={() => createListing.mutate()}
            disabled={!isValid || createListing.isPending}
            style={{
              backgroundColor: isValid ? "#c026d3" : "#e5e7eb",
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
              marginBottom: 32,
            }}
          >
            {createListing.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={{
                  color: isValid ? "#fff" : "#9ca3af",
                  fontWeight: "700",
                  fontSize: 16,
                }}
              >
                Create Listing
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
