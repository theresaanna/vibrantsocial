import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

interface PollProps {
  postId: string;
  question: string;
  options: PollOption[];
  expiresAt: string | null;
}

export function Poll({ postId, question, options: initialOptions, expiresAt }: PollProps) {
  const queryClient = useQueryClient();
  const [options, setOptions] = useState(initialOptions);
  const [votedId, setVotedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const totalVotes = options.reduce((sum, o) => sum + o.votes, 0);
  const isExpired = expiresAt ? new Date(expiresAt).getTime() <= now : false;

  // Fetch persisted votes
  const { data: pollData, isLoading: pollLoading } = useQuery({
    queryKey: ["poll-votes", postId],
    queryFn: () =>
      api.rpc<{ votes: Record<string, number>; userVote: string | null }>(
        "getPollVotes",
        postId
      ),
  });

  // Apply fetched votes
  useEffect(() => {
    if (!pollData) return;
    setOptions((prev) =>
      prev.map((o) => ({ ...o, votes: pollData.votes[o.id] ?? 0 }))
    );
    if (pollData.userVote) setVotedId(pollData.userVote);
  }, [pollData]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt || isExpired) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt, isExpired]);

  const voteMutation = useMutation({
    mutationFn: (optionId: string) =>
      api.rpc<{ votes: Record<string, number>; userVote: string }>(
        "votePoll",
        postId,
        optionId
      ),
    onMutate: (optionId) => {
      // Optimistic update
      setVotedId(optionId);
      setOptions((prev) =>
        prev.map((o) =>
          o.id === optionId ? { ...o, votes: o.votes + 1 } : o
        )
      );
    },
    onSuccess: (result) => {
      setOptions((prev) =>
        prev.map((o) => ({ ...o, votes: result.votes[o.id] ?? 0 }))
      );
      queryClient.invalidateQueries({ queryKey: ["poll-votes", postId] });
    },
    onError: (_, optionId) => {
      // Revert
      setVotedId(null);
      setOptions((prev) =>
        prev.map((o) =>
          o.id === optionId ? { ...o, votes: Math.max(0, o.votes - 1) } : o
        )
      );
    },
  });

  function getTimeRemaining(): string {
    if (!expiresAt) return "";
    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) return "Poll ended";
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h remaining`;
    if (hours > 0) return `${hours}h ${minutes % 60}m remaining`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s remaining`;
    return `${seconds}s remaining`;
  }

  const showResults = !!votedId || isExpired;

  if (pollLoading) {
    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: "#e5e7eb",
          borderRadius: 12,
          padding: 16,
          marginVertical: 8,
        }}
      >
        <Text style={{ fontWeight: "600", fontSize: 15, marginBottom: 12 }}>
          {question}
        </Text>
        {initialOptions.map((opt) => (
          <View
            key={opt.id}
            style={{
              height: 40,
              borderRadius: 8,
              backgroundColor: "#f3f4f6",
              marginBottom: 8,
            }}
          />
        ))}
      </View>
    );
  }

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 12,
        padding: 16,
        marginVertical: 8,
      }}
    >
      <Text style={{ fontWeight: "600", fontSize: 15, marginBottom: 12 }}>
        {question}
      </Text>

      {options.map((option) => {
        const pct = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
        const isVoted = votedId === option.id;

        if (showResults) {
          return (
            <View
              key={option.id}
              style={{
                marginBottom: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: isVoted ? "#c026d3" : "#e5e7eb",
                overflow: "hidden",
              }}
            >
              {/* Progress bar background */}
              <View style={{ position: "relative", paddingHorizontal: 12, paddingVertical: 10 }}>
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: `${pct}%`,
                    backgroundColor: isVoted ? "#f5d0fe" : "#f3f4f6",
                    borderRadius: 7,
                  }}
                />
                <View style={{ flexDirection: "row", justifyContent: "space-between", position: "relative" }}>
                  <Text style={{ fontSize: 14, color: "#1f2937" }}>
                    {isVoted ? "\u2713 " : ""}
                    {option.text}
                  </Text>
                  <Text style={{ fontSize: 14, color: "#6b7280" }}>{pct}%</Text>
                </View>
              </View>
            </View>
          );
        }

        return (
          <TouchableOpacity
            key={option.id}
            onPress={() => voteMutation.mutate(option.id)}
            disabled={voteMutation.isPending}
            activeOpacity={0.7}
            style={{
              marginBottom: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#d1d5db",
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text style={{ fontSize: 14, color: "#1f2937" }}>{option.text}</Text>
          </TouchableOpacity>
        );
      })}

      {/* Meta info */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ fontSize: 12, color: "#9ca3af" }}>
          {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
        </Text>
        {expiresAt && (
          <Text
            style={{
              fontSize: 12,
              color: isExpired ? "#ef4444" : "#9ca3af",
            }}
          >
            {getTimeRemaining()}
          </Text>
        )}
      </View>
    </View>
  );
}
