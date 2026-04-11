import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Avatar } from "@/components/avatar";

export default function EditProfileScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar ?? null);
  const [newAvatarFile, setNewAvatarFile] = useState<{
    uri: string;
    name: string;
    type: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setAvatarUri(asset.uri);
      setNewAvatarFile({
        uri: asset.uri,
        name: asset.fileName ?? "avatar.jpg",
        type: asset.mimeType ?? "image/jpeg",
      });
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      // Upload new avatar first if selected
      if (newAvatarFile) {
        setIsUploadingAvatar(true);
        try {
          await api.upload(newAvatarFile);
        } catch (err) {
          Alert.alert("Error", "Failed to upload avatar. Profile changes will still be saved.");
        }
        setIsUploadingAvatar(false);
      }

      // Build a FormData-like object for the RPC call
      await api.rpc("updateProfile", {
        username: username.trim() || null,
        displayName: displayName.trim() || null,
        bio: bio.trim() || null,
      });

      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      Alert.alert("Success", "Profile updated", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to update profile"
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Edit Profile" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: "#fff" }}
        contentContainerStyle={{ padding: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.7}>
            <Avatar uri={avatarUri} size={96} />
            <View
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                backgroundColor: "#c026d3",
                borderRadius: 14,
                width: 28,
                height: 28,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 14 }}>+</Text>
            </View>
          </TouchableOpacity>
          <Text
            style={{
              color: "#9ca3af",
              fontSize: 13,
              marginTop: 8,
            }}
          >
            Tap to change photo
          </Text>
        </View>

        {/* Display Name */}
        <Text style={styles.label}>Display Name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your display name"
          placeholderTextColor="#9ca3af"
          autoCapitalize="words"
        />

        {/* Username */}
        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="your_username"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 4, marginBottom: 12 }}>
          3-30 characters, letters, numbers, and underscores only
        </Text>

        {/* Bio */}
        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, { height: 100, textAlignVertical: "top" }]}
          value={bio}
          onChangeText={setBio}
          placeholder="Tell people about yourself"
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={4}
        />

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          style={{
            backgroundColor: "#c026d3",
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            marginTop: 24,
            opacity: isSaving ? 0.6 : 1,
          }}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
              Save Changes
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = {
  label: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: "#1f2937",
    backgroundColor: "#f9fafb",
    marginBottom: 16,
  },
};
