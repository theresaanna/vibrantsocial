import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useUserTheme } from "@/components/themed-view";
import { hexToRgba } from "@/lib/user-theme";

// ── Types ─────────────────────────────────────────────────────────

interface FeedSummaryResult {
  summary: string | null;
  missedCount: number;
  tooMany: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────

/** Parse **bold** markdown into React Native Text nodes. */
function BoldText({ text, color }: { text: string; color: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <Text style={{ fontSize: 14, color, lineHeight: 20 }}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={{ fontWeight: "700" }}>
            {part}
          </Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}

/** Skeleton shimmer lines for loading state. */
function SkeletonLines({ color }: { color: string }) {
  const shimmer = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  return (
    <View style={{ marginTop: 8, gap: 6 }}>
      <Animated.View
        style={{
          height: 12,
          width: "75%",
          borderRadius: 6,
          backgroundColor: color,
          opacity: shimmer,
        }}
      />
      <Animated.View
        style={{
          height: 12,
          width: "50%",
          borderRadius: 6,
          backgroundColor: color,
          opacity: shimmer,
        }}
      />
    </View>
  );
}

// ── Component ─────────────────────────────────────────────────────

export function FeedSummaryBanner() {
  const theme = useUserTheme();
  const containerBg = hexToRgba(theme.containerColor, theme.containerOpacity);

  const [summary, setSummary] = useState<string | null>(null);
  const [missedCount, setMissedCount] = useState(0);
  const [tooMany, setTooMany] = useState(false);
  const [checked, setChecked] = useState(false);
  const [generating, setGenerating] = useState(false);
  const fetchedRef = useRef(false);

  // Step 1: Get lastSeenFeedAt
  const { data: lastSeenFeedAt, isFetched } = useQuery({
    queryKey: ["lastSeenFeedAt"],
    queryFn: () => api.rpc<string | null>("getLastSeenFeedAt"),
  });

  // Step 2: Fetch summary data once we have lastSeenFeedAt
  useEffect(() => {
    if (!isFetched || fetchedRef.current) return;
    fetchedRef.current = true;

    if (!lastSeenFeedAt) {
      setChecked(true);
      return;
    }

    api
      .rpc<FeedSummaryResult>("fetchFeedSummary", lastSeenFeedAt)
      .then((result) => {
        setSummary(result.summary);
        setMissedCount(result.missedCount);
        setTooMany(result.tooMany);
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, [isFetched, lastSeenFeedAt]);

  // Step 3: Generate/regenerate on demand
  async function handleSummarize() {
    if (!lastSeenFeedAt) return;
    setGenerating(true);
    try {
      const result = await api.rpc<string | null>(
        "generateFeedSummaryOnDemand",
        lastSeenFeedAt
      );
      setSummary(
        result ?? "Your friends have been posting! Scroll down to see what's new."
      );
      setTooMany(false);
    } catch {
      setSummary(
        "Your friends have been posting! Scroll down to see what's new."
      );
    } finally {
      setGenerating(false);
    }
  }

  // Update lastSeenFeedAt on mount (fire-and-forget)
  const updatedRef = useRef(false);
  useEffect(() => {
    if (updatedRef.current) return;
    updatedRef.current = true;
    api.rpc("updateLastSeenFeedAt").catch(() => {});
  }, []);

  // Don't show anything until we've checked
  if (!checked) return null;

  // Nothing to show
  if (!summary && missedCount === 0) return null;

  return (
    <View
      style={{
        marginHorizontal: 12,
        marginTop: 8,
        marginBottom: 4,
        backgroundColor: containerBg,
        borderRadius: 16,
        padding: 16,
      }}
    >
      <Text
        style={{
          fontSize: 15,
          fontWeight: "700",
          color: theme.textColor,
          marginBottom: 4,
        }}
      >
        While you were away…
      </Text>

      {/* Loading skeleton */}
      {generating && <SkeletonLines color={theme.secondaryColor + "44"} />}

      {/* Summary text + regenerate */}
      {!generating && summary && (
        <View style={{ marginTop: 4 }}>
          <BoldText text={summary} color={theme.secondaryColor} />
          <TouchableOpacity
            onPress={handleSummarize}
            style={{
              alignSelf: "flex-start",
              marginTop: 10,
              backgroundColor: "#c026d3cc",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#fff" }}>
              Regenerate summary
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Post count + summarize button */}
      {!generating && !summary && missedCount > 0 && (
        <View style={{ marginTop: 4 }}>
          <Text style={{ fontSize: 14, color: theme.secondaryColor }}>
            You have {tooMany ? `${missedCount}+` : missedCount} new{" "}
            {missedCount === 1 ? "post" : "posts"} in your feed!
          </Text>
          <TouchableOpacity
            onPress={handleSummarize}
            style={{
              alignSelf: "flex-start",
              marginTop: 10,
              backgroundColor: "#c026d3",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#fff" }}>
              Summarize what I missed
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
