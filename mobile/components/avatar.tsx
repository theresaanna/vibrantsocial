import { View } from "react-native";
import { Image } from "expo-image";
import { FramedAvatar } from "./framed-avatar";

interface AvatarProps {
  uri: string | null | undefined;
  size: number;
  frameId?: string | null;
}

/**
 * Reusable avatar component wrapping expo-image with optional profile frame overlay.
 * When a frameId is provided, delegates to FramedAvatar for proper frame rendering.
 */
export function Avatar({ uri, size, frameId }: AvatarProps) {
  if (frameId) {
    return <FramedAvatar uri={uri} size={size} frameId={frameId} />;
  }

  const borderRadius = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={{ uri: uri ?? undefined }}
        style={{
          width: size,
          height: size,
          borderRadius,
          backgroundColor: "#e5e7eb",
        }}
      />
    </View>
  );
}
