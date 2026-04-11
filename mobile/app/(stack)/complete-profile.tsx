import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/lib/api";
import Toast from "react-native-toast-message";

export default function CompleteProfileScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  async function handleSubmit() {
    if (!username.trim()) {
      Toast.show({ type: "error", text1: "Username is required" });
      return;
    }

    setLoading(true);
    try {
      // Upload avatar if selected
      let avatarUrl: string | undefined;
      if (avatarUri) {
        const uploadResult = await api.upload({
          uri: avatarUri,
          name: "avatar.jpg",
          type: "image/jpeg",
        });
        avatarUrl = uploadResult.url;
      }

      const profileData: Record<string, string | null> = {
        username: username.trim(),
      };
      if (displayName.trim()) profileData.displayName = displayName.trim();
      if (bio.trim()) profileData.bio = bio.trim();
      if (avatarUrl) profileData.avatar = avatarUrl;

      const result = await api.rpc<{ success: boolean; message?: string }>(
        "updateProfile",
        profileData
      );

      if (result && (result as any).success !== false) {
        Toast.show({ type: "success", text1: "Profile completed!" });
        router.replace("/(tabs)");
      } else {
        Toast.show({ type: "error", text1: (result as any)?.message || "Failed to update profile" });
      }
    } catch (e: any) {
      Toast.show({ type: "error", text1: e?.message || "Failed to complete profile" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#fff" }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 8 }}>Complete your profile</Text>
        <Text style={{ color: "#6b7280", marginBottom: 32 }}>
          Set up your profile so others can find and connect with you.
        </Text>

        {/* Avatar */}
        <TouchableOpacity
          onPress={pickAvatar}
          style={{ alignSelf: "center", marginBottom: 24 }}
        >
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={{ width: 96, height: 96, borderRadius: 48 }}
            />
          ) : (
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: "#f3e8ff",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 32, color: "#c026d3" }}>+</Text>
            </View>
          )}
          <Text style={{ textAlign: "center", color: "#c026d3", fontSize: 14, marginTop: 8 }}>
            {avatarUri ? "Change photo" : "Add photo"}
          </Text>
        </TouchableOpacity>

        {/* Username */}
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 6 }}>Username *</Text>
        <TextInput
          placeholder="username"
          value={username}
          onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            borderWidth: 1,
            borderColor: "#d1d5db",
            borderRadius: 12,
            padding: 16,
            fontSize: 16,
            marginBottom: 16,
          }}
        />

        {/* Display Name */}
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 6 }}>Display Name</Text>
        <TextInput
          placeholder="Your display name"
          value={displayName}
          onChangeText={setDisplayName}
          style={{
            borderWidth: 1,
            borderColor: "#d1d5db",
            borderRadius: 12,
            padding: 16,
            fontSize: 16,
            marginBottom: 16,
          }}
        />

        {/* Bio */}
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 6 }}>Bio</Text>
        <TextInput
          placeholder="Tell people about yourself"
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={3}
          style={{
            borderWidth: 1,
            borderColor: "#d1d5db",
            borderRadius: 12,
            padding: 16,
            fontSize: 16,
            marginBottom: 24,
            minHeight: 80,
            textAlignVertical: "top",
          }}
        />

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading || !username.trim()}
          style={{
            backgroundColor: "#c026d3",
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            opacity: loading || !username.trim() ? 0.7 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Complete profile</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
