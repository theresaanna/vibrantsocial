import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { Audio } from "expo-av";
import type { MessageData } from "@vibrantsocial/shared/types";
import { formatDistanceToNow } from "@/lib/date";

interface MessageBubbleProps {
  message: MessageData;
  isOwn: boolean;
  readStatus?: "sent" | "delivered" | "read";
  onDelete?: (messageId: string) => void;
  onCopy?: (content: string) => void;
}

function ReadReceiptCheckmarks({
  status,
}: {
  status: "sent" | "delivered" | "read";
}) {
  if (status === "sent") {
    return <Text style={{ fontSize: 12, color: "#9ca3af" }}>{"\u2713"}</Text>;
  }
  if (status === "delivered") {
    return <Text style={{ fontSize: 12, color: "#9ca3af" }}>{"\u2713\u2713"}</Text>;
  }
  // read
  return <Text style={{ fontSize: 12, color: "#c026d3" }}>{"\u2713\u2713"}</Text>;
}

function VoiceMessagePlayer({
  mediaUrl,
  isOwn,
}: {
  mediaUrl: string;
  isOwn: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  const togglePlayback = useCallback(async () => {
    try {
      if (isPlaying && soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        return;
      }

      if (soundRef.current) {
        await soundRef.current.playAsync();
        setIsPlaying(true);
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: mediaUrl },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          setPosition(status.positionMillis);
          if (status.durationMillis) setDuration(status.durationMillis);
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPosition(0);
            soundRef.current?.setPositionAsync(0);
          }
        }
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, [isPlaying, mediaUrl]);

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? position / duration : 0;

  return (
    <TouchableOpacity
      onPress={togglePlayback}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 4,
        minWidth: 160,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: isOwn ? "rgba(255,255,255,0.2)" : "#c026d3",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 8,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 14 }}>
          {isPlaying ? "\u275A\u275A" : "\u25B6"}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <View
          style={{
            height: 4,
            backgroundColor: isOwn ? "rgba(255,255,255,0.3)" : "#e5e7eb",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: 4,
              width: `${progress * 100}%`,
              backgroundColor: isOwn ? "#fff" : "#c026d3",
              borderRadius: 2,
            }}
          />
        </View>
        <Text
          style={{
            fontSize: 11,
            color: isOwn ? "rgba(255,255,255,0.7)" : "#9ca3af",
            marginTop: 2,
          }}
        >
          {formatTime(duration || 0)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function MessageBubble({
  message,
  isOwn,
  readStatus = "sent",
  onDelete,
  onCopy,
}: MessageBubbleProps) {
  const [imageViewerVisible, setImageViewerVisible] = useState(false);

  if (message.deletedAt) {
    return (
      <View
        style={{
          alignItems: isOwn ? "flex-end" : "flex-start",
          paddingHorizontal: 16,
          paddingVertical: 4,
        }}
      >
        <View
          style={{
            backgroundColor: "#f3f4f6",
            borderRadius: 16,
            padding: 12,
          }}
        >
          <Text style={{ color: "#9ca3af", fontStyle: "italic", fontSize: 14 }}>
            This message was deleted
          </Text>
        </View>
      </View>
    );
  }

  const handleLongPress = () => {
    const options: { text: string; onPress: () => void; style?: "destructive" }[] = [];

    if (message.content) {
      options.push({
        text: "Copy",
        onPress: () => onCopy?.(message.content),
      });
    }
    if (isOwn && onDelete) {
      options.push({
        text: "Delete",
        onPress: () => {
          Alert.alert("Delete Message", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => onDelete(message.id),
            },
          ]);
        },
        style: "destructive",
      });
    }

    if (options.length === 0) return;

    Alert.alert(
      "Message",
      undefined,
      [
        ...options.map((opt) => ({
          text: opt.text,
          onPress: opt.onPress,
          style: opt.style as "destructive" | "cancel" | "default" | undefined,
        })),
        { text: "Cancel", style: "cancel" as const },
      ]
    );
  };

  const isImage = message.mediaType === "image" && message.mediaUrl;
  const isAudio = message.mediaType === "audio" && message.mediaUrl;

  return (
    <View
      style={{
        alignItems: isOwn ? "flex-end" : "flex-start",
        paddingHorizontal: 16,
        paddingVertical: 4,
      }}
    >
      {/* Sender info for non-own messages */}
      {!isOwn && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <Image
            source={{ uri: message.sender.avatar ?? undefined }}
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              marginRight: 6,
              backgroundColor: "#e5e7eb",
            }}
          />
          <Text style={{ fontSize: 12, color: "#9ca3af" }}>
            {message.sender.displayName || message.sender.username}
          </Text>
        </View>
      )}

      <TouchableOpacity
        onLongPress={handleLongPress}
        activeOpacity={0.8}
        style={{
          backgroundColor: isOwn ? "#c026d3" : "#f3f4f6",
          borderRadius: 16,
          padding: isImage ? 4 : 12,
          maxWidth: "75%",
          overflow: "hidden",
        }}
      >
        {/* Image message */}
        {isImage && (
          <>
            <TouchableOpacity onPress={() => setImageViewerVisible(true)}>
              <Image
                source={{ uri: message.mediaUrl! }}
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: 12,
                }}
                contentFit="cover"
              />
            </TouchableOpacity>
            {message.content ? (
              <Text
                style={{
                  color: isOwn ? "#fff" : "#1f2937",
                  fontSize: 15,
                  padding: 8,
                }}
              >
                {message.content}
              </Text>
            ) : null}
          </>
        )}

        {/* Voice message */}
        {isAudio && (
          <VoiceMessagePlayer mediaUrl={message.mediaUrl!} isOwn={isOwn} />
        )}

        {/* Text-only message */}
        {!isImage && !isAudio && (
          <Text style={{ color: isOwn ? "#fff" : "#1f2937", fontSize: 15 }}>
            {message.content}
          </Text>
        )}
      </TouchableOpacity>

      {/* Metadata row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 2,
          gap: 4,
        }}
      >
        <Text style={{ fontSize: 10, color: "#9ca3af" }}>
          {formatDistanceToNow(new Date(message.createdAt))}
        </Text>
        {isOwn && <ReadReceiptCheckmarks status={readStatus} />}
      </View>

      {/* Full screen image viewer */}
      {isImage && (
        <Modal
          visible={imageViewerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setImageViewerVisible(false)}
        >
          <Pressable
            onPress={() => setImageViewerVisible(false)}
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.9)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Image
              source={{ uri: message.mediaUrl! }}
              style={{ width: "90%", height: "70%" }}
              contentFit="contain"
            />
            <TouchableOpacity
              onPress={() => setImageViewerVisible(false)}
              style={{
                position: "absolute",
                top: 60,
                right: 20,
                padding: 8,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 24 }}>{"\u2715"}</Text>
            </TouchableOpacity>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}
