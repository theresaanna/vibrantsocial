import { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, Animated, PanResponder } from "react-native";
import { Audio } from "expo-av";

interface VoiceRecorderProps {
  onRecordingComplete: (uri: string, duration: number) => void;
  onCancel: () => void;
  maxDuration?: number;
}

const MAX_DURATION_DEFAULT = 120; // 2 minutes

export function VoiceRecorder({
  onRecordingComplete,
  onCancel,
  maxDuration = MAX_DURATION_DEFAULT,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cancelSlide = useRef(new Animated.Value(0)).current;
  const [isCancelling, setIsCancelling] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          cancelSlide.setValue(gestureState.dx);
          setIsCancelling(gestureState.dx < -80);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -80) {
          handleCancel();
        } else {
          Animated.spring(cancelSlide, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
          setIsCancelling(false);
        }
      },
    })
  ).current;

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, [cleanup]);

  // Pulse animation
  useEffect(() => {
    if (!isRecording) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isRecording, pulseAnim]);

  // Auto-stop at max duration
  useEffect(() => {
    if (isRecording && duration >= maxDuration) {
      handleStop();
    }
  }, [duration, maxDuration, isRecording]);

  async function startRecording() {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setError("Microphone permission denied");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch {
      setError("Failed to start recording");
    }
  }

  async function handleStop() {
    const recording = recordingRef.current;
    if (!recording) return;

    cleanup();
    setIsRecording(false);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri) {
        onRecordingComplete(uri, duration);
      }
    } catch {
      setError("Failed to save recording");
    }
    recordingRef.current = null;
  }

  function handleCancel() {
    const recording = recordingRef.current;
    cleanup();
    setIsRecording(false);

    if (recording) {
      recording.stopAndUnloadAsync().catch(() => {});
    }
    recordingRef.current = null;
    onCancel();
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const remaining = Math.max(0, maxDuration - duration);

  if (error) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 12,
          backgroundColor: "#fef2f2",
          borderRadius: 12,
        }}
      >
        <Text style={{ flex: 1, color: "#dc2626", fontSize: 14 }}>
          {error}
        </Text>
        <TouchableOpacity onPress={onCancel}>
          <Text style={{ color: "#dc2626", fontWeight: "600", fontSize: 14 }}>
            Dismiss
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        backgroundColor: "#f9fafb",
        borderRadius: 12,
        transform: [{ translateX: cancelSlide }],
      }}
      {...panResponder.panHandlers}
    >
      {/* Recording indicator */}
      <Animated.View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: "#ef4444",
          transform: [{ scale: pulseAnim }],
        }}
      />

      {/* Duration */}
      <Text
        style={{
          fontFamily: "monospace",
          fontSize: 14,
          color: remaining <= 5 ? "#ef4444" : "#374151",
          marginLeft: 10,
        }}
      >
        {formatTime(duration)}
      </Text>

      {/* Remaining */}
      <Text
        style={{
          fontFamily: "monospace",
          fontSize: 12,
          color: remaining <= 5 ? "#f87171" : "#9ca3af",
          marginLeft: 8,
        }}
      >
        {remaining}s left
      </Text>

      {/* Slide to cancel hint */}
      <Text
        style={{
          flex: 1,
          textAlign: "center",
          fontSize: 12,
          color: isCancelling ? "#ef4444" : "#9ca3af",
        }}
      >
        {isCancelling ? "Release to cancel" : "< Slide to cancel"}
      </Text>

      {/* Cancel button */}
      <TouchableOpacity
        onPress={handleCancel}
        style={{ paddingHorizontal: 12, paddingVertical: 6 }}
      >
        <Text style={{ color: "#6b7280", fontSize: 14 }}>Cancel</Text>
      </TouchableOpacity>

      {/* Stop & send button */}
      <TouchableOpacity
        onPress={handleStop}
        disabled={!isRecording}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: isRecording ? "#ef4444" : "#d1d5db",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 2,
            backgroundColor: "#fff",
          }}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}
