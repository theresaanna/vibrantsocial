import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";

export interface PollCreatorData {
  question: string;
  options: string[];
  durationHours: number;
}

interface PollCreatorProps {
  data: PollCreatorData;
  onChange: (data: PollCreatorData) => void;
  onRemove: () => void;
}

const DURATION_OPTIONS = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "12 hours", hours: 12 },
  { label: "1 day", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
];

export function PollCreator({ data, onChange, onRemove }: PollCreatorProps) {
  function updateQuestion(question: string) {
    onChange({ ...data, question });
  }

  function updateOption(index: number, text: string) {
    const options = [...data.options];
    options[index] = text;
    onChange({ ...data, options });
  }

  function addOption() {
    if (data.options.length >= 6) return;
    onChange({ ...data, options: [...data.options, ""] });
  }

  function removeOption(index: number) {
    if (data.options.length <= 2) return;
    const options = data.options.filter((_, i) => i !== index);
    onChange({ ...data, options });
  }

  function setDuration(hours: number) {
    onChange({ ...data, durationHours: hours });
  }

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
        backgroundColor: "#fafafa",
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <Text style={{ fontWeight: "600", fontSize: 16, color: "#1f2937" }}>
          Poll
        </Text>
        <TouchableOpacity onPress={onRemove}>
          <Text style={{ color: "#ef4444", fontSize: 14 }}>Remove</Text>
        </TouchableOpacity>
      </View>

      {/* Question */}
      <TextInput
        placeholder="Ask a question..."
        value={data.question}
        onChangeText={updateQuestion}
        style={{
          backgroundColor: "#fff",
          borderWidth: 1,
          borderColor: "#d1d5db",
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 15,
          marginBottom: 12,
        }}
      />

      {/* Options */}
      {data.options.map((option, index) => (
        <View
          key={index}
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <TextInput
            placeholder={`Option ${index + 1}`}
            value={option}
            onChangeText={(text) => updateOption(index, text)}
            style={{
              flex: 1,
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "#d1d5db",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
            }}
          />
          {data.options.length > 2 && (
            <TouchableOpacity
              onPress={() => removeOption(index)}
              style={{ marginLeft: 8, padding: 4 }}
            >
              <Text style={{ color: "#ef4444", fontSize: 18, fontWeight: "700" }}>
                X
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {/* Add option button */}
      {data.options.length < 6 && (
        <TouchableOpacity
          onPress={addOption}
          style={{
            borderWidth: 1,
            borderColor: "#c026d3",
            borderRadius: 8,
            borderStyle: "dashed",
            paddingVertical: 10,
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text style={{ color: "#c026d3", fontSize: 14, fontWeight: "600" }}>
            + Add Option
          </Text>
        </TouchableOpacity>
      )}

      {/* Duration selector */}
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: "#6b7280",
          marginBottom: 8,
        }}
      >
        Poll Duration
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {DURATION_OPTIONS.map((d) => (
          <TouchableOpacity
            key={d.hours}
            onPress={() => setDuration(d.hours)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor:
                data.durationHours === d.hours ? "#c026d3" : "#f3f4f6",
            }}
          >
            <Text
              style={{
                fontSize: 13,
                color: data.durationHours === d.hours ? "#fff" : "#374151",
                fontWeight: data.durationHours === d.hours ? "600" : "400",
              }}
            >
              {d.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
