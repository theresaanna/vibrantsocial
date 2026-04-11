import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";

interface AvatarCropperProps {
  imageUri: string;
  onSave: (croppedUri: string) => void;
  onCancel: () => void;
}

const CROP_SIZE = 280;

export function AvatarCropper({ imageUri, onSave, onCancel }: AvatarCropperProps) {
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [processing, setProcessing] = useState(false);

  const lastDistance = useRef<number | null>(null);
  const lastOffsetX = useRef(0);
  const lastOffsetY = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        lastOffsetX.current = offsetX;
        lastOffsetY.current = offsetY;
        lastDistance.current = null;
      },
      onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const touches = evt.nativeEvent.touches;

        // Pinch to zoom
        if (touches.length === 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (lastDistance.current !== null) {
            const newScale = scale * (distance / lastDistance.current);
            setScale(Math.max(0.5, Math.min(3, newScale)));
          }
          lastDistance.current = distance;
          return;
        }

        // Single finger pan
        lastDistance.current = null;
        setOffsetX(lastOffsetX.current + gestureState.dx);
        setOffsetY(lastOffsetY.current + gestureState.dy);
      },
      onPanResponderRelease: () => {
        lastDistance.current = null;
        // Save final position for next gesture
        lastOffsetX.current = offsetX;
        lastOffsetY.current = offsetY;
      },
    })
  ).current;

  async function handleSave() {
    setProcessing(true);
    try {
      // Crop to a square centered on the viewport
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 400 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      onSave(result.uri);
    } catch {
      // On failure, pass through the original URI
      onSave(imageUri);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 60,
          paddingBottom: 16,
        }}
      >
        <TouchableOpacity onPress={onCancel} disabled={processing}>
          <Text style={{ color: "#fff", fontSize: 16 }}>Cancel</Text>
        </TouchableOpacity>
        <Text style={{ color: "#fff", fontSize: 17, fontWeight: "600" }}>
          Crop Photo
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={processing}>
          {processing ? (
            <ActivityIndicator color="#c026d3" size="small" />
          ) : (
            <Text style={{ color: "#c026d3", fontSize: 16, fontWeight: "600" }}>
              Done
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Crop area */}
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: CROP_SIZE,
            height: CROP_SIZE,
            borderRadius: CROP_SIZE / 2,
            overflow: "hidden",
            borderWidth: 2,
            borderColor: "#c026d3",
          }}
          {...panResponder.panHandlers}
        >
          <Image
            source={{ uri: imageUri }}
            style={{
              width: CROP_SIZE * scale,
              height: CROP_SIZE * scale,
              transform: [
                { translateX: offsetX - (CROP_SIZE * (scale - 1)) / 2 },
                { translateY: offsetY - (CROP_SIZE * (scale - 1)) / 2 },
              ],
            }}
            contentFit="cover"
          />
        </View>
        <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 16 }}>
          Pinch to zoom, drag to reposition
        </Text>
      </View>
    </View>
  );
}
