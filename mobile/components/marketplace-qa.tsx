import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Avatar } from "@/components/avatar";
import { formatDistanceToNow } from "@/lib/date";

interface QuestionData {
  id: string;
  question: string;
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
  asker: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  };
}

interface MarketplaceQAProps {
  marketplacePostId: string;
  postAuthorId: string;
  currentUserId?: string;
}

export function MarketplaceQA({ marketplacePostId, postAuthorId, currentUserId }: MarketplaceQAProps) {
  const queryClient = useQueryClient();
  const [newQuestion, setNewQuestion] = useState("");
  const isAuthor = currentUserId === postAuthorId;

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["marketplaceQA", marketplacePostId],
    queryFn: () => api.rpc<QuestionData[]>("getMarketplaceQA", marketplacePostId),
  });

  const askMutation = useMutation({
    mutationFn: (question: string) =>
      api.rpc("askMarketplaceQuestion", marketplacePostId, question),
    onSuccess: () => {
      setNewQuestion("");
      queryClient.invalidateQueries({ queryKey: ["marketplaceQA", marketplacePostId] });
    },
  });

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
      <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 12, color: "#1f2937" }}>
        Q&A {questions.length > 0 ? `(${questions.length})` : ""}
      </Text>

      {/* Ask question input - only for non-authors */}
      {currentUserId && !isAuthor && (
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          <TextInput
            value={newQuestion}
            onChangeText={setNewQuestion}
            placeholder="Ask a question about this item..."
            maxLength={1000}
            style={{
              flex: 1,
              backgroundColor: "#f3f4f6",
              borderRadius: 10,
              padding: 10,
              fontSize: 14,
            }}
          />
          <TouchableOpacity
            onPress={() => newQuestion.trim() && askMutation.mutate(newQuestion.trim())}
            disabled={!newQuestion.trim() || askMutation.isPending}
            style={{
              backgroundColor: newQuestion.trim() ? "#c026d3" : "#e5e7eb",
              borderRadius: 10,
              paddingHorizontal: 16,
              justifyContent: "center",
            }}
          >
            {askMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: newQuestion.trim() ? "#fff" : "#9ca3af", fontWeight: "600", fontSize: 14 }}>
                Ask
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color="#c026d3" style={{ padding: 16 }} />
      ) : questions.length === 0 ? (
        <Text style={{ color: "#9ca3af", fontSize: 14, paddingBottom: 16 }}>
          No questions yet.{!isAuthor && currentUserId ? " Be the first to ask!" : ""}
        </Text>
      ) : (
        <View style={{ minHeight: 100 }}>
          <FlashList
            data={questions}
            estimatedItemSize={100}
            scrollEnabled={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <QuestionItem
                question={item}
                isAuthor={isAuthor}
                marketplacePostId={marketplacePostId}
              />
            )}
          />
        </View>
      )}
    </View>
  );
}

function QuestionItem({
  question,
  isAuthor,
  marketplacePostId,
}: {
  question: QuestionData;
  isAuthor: boolean;
  marketplacePostId: string;
}) {
  const queryClient = useQueryClient();
  const [answerText, setAnswerText] = useState("");
  const [showAnswerInput, setShowAnswerInput] = useState(false);

  const answerMutation = useMutation({
    mutationFn: (answer: string) =>
      api.rpc("answerMarketplaceQuestion", question.id, answer),
    onSuccess: () => {
      setAnswerText("");
      setShowAnswerInput(false);
      queryClient.invalidateQueries({ queryKey: ["marketplaceQA", marketplacePostId] });
    },
  });

  return (
    <View
      style={{
        backgroundColor: "#f9fafb",
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
      }}
    >
      {/* Question */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
        <Avatar uri={question.asker.avatar} size={28} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#1f2937" }}>
              {question.asker.displayName || question.asker.username}
            </Text>
            <Text style={{ fontSize: 12, color: "#9ca3af" }}>
              {formatDistanceToNow(new Date(question.createdAt))}
            </Text>
          </View>
          <Text style={{ fontSize: 14, color: "#4b5563", marginTop: 2, lineHeight: 20 }}>
            {question.question}
          </Text>
        </View>
      </View>

      {/* Answer */}
      {question.answer ? (
        <View
          style={{
            marginLeft: 36,
            marginTop: 8,
            backgroundColor: "#faf5ff",
            borderRadius: 8,
            padding: 10,
            borderLeftWidth: 3,
            borderLeftColor: "#c026d3",
          }}
        >
          <Text style={{ fontSize: 12, color: "#c026d3", fontWeight: "600", marginBottom: 2 }}>
            Seller
          </Text>
          <Text style={{ fontSize: 14, color: "#4b5563", lineHeight: 20 }}>
            {question.answer}
          </Text>
          {question.answeredAt && (
            <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              {formatDistanceToNow(new Date(question.answeredAt))}
            </Text>
          )}
        </View>
      ) : isAuthor ? (
        <View style={{ marginLeft: 36, marginTop: 8 }}>
          {showAnswerInput ? (
            <View style={{ gap: 8 }}>
              <TextInput
                value={answerText}
                onChangeText={setAnswerText}
                placeholder="Write your answer..."
                maxLength={2000}
                multiline
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  padding: 10,
                  fontSize: 14,
                  minHeight: 50,
                }}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => answerText.trim() && answerMutation.mutate(answerText.trim())}
                  disabled={!answerText.trim() || answerMutation.isPending}
                  style={{
                    backgroundColor: answerText.trim() ? "#c026d3" : "#e5e7eb",
                    borderRadius: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ color: answerText.trim() ? "#fff" : "#9ca3af", fontWeight: "600", fontSize: 13 }}>
                    {answerMutation.isPending ? "Posting..." : "Answer"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowAnswerInput(false);
                    setAnswerText("");
                  }}
                  style={{ paddingHorizontal: 14, paddingVertical: 6 }}
                >
                  <Text style={{ color: "#9ca3af", fontSize: 13 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setShowAnswerInput(true)}>
              <Text style={{ color: "#c026d3", fontWeight: "600", fontSize: 13 }}>
                Answer this question
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}
