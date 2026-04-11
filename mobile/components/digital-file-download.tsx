import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { api } from "@/lib/api";

interface DigitalFileDownloadProps {
  marketplacePostId: string;
  fileName: string;
  fileSize: number;
  isFree: boolean;
  isOwner: boolean;
  downloadCount?: number;
}

export function DigitalFileDownload({
  marketplacePostId,
  fileName,
  fileSize,
  isFree,
  isOwner,
  downloadCount: initialDownloadCount,
}: DigitalFileDownloadProps) {
  const [couponInput, setCouponInput] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadCount, setDownloadCount] = useState(initialDownloadCount ?? 0);

  async function downloadFile(downloadUrl: string, name: string) {
    const fileUri = `${FileSystem.cacheDirectory}${name}`;

    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      fileUri,
      {},
      (downloadProgress) => {
        const pct =
          downloadProgress.totalBytesWritten /
          downloadProgress.totalBytesExpectedToWrite;
        setProgress(pct);
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result) {
      throw new Error("Download failed");
    }

    // Share/save the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(result.uri);
    } else {
      Alert.alert("Downloaded", `File saved to ${result.uri}`);
    }
  }

  async function handleFreeDownload() {
    setIsLoading(true);
    setError("");
    setProgress(0);

    try {
      const result = await api.rpc<{ success: boolean; downloadUrl?: string; fileName?: string; message?: string }>(
        "downloadFreeFile",
        marketplacePostId
      );

      if (result.success && result.downloadUrl) {
        setDownloadCount((c) => c + 1);
        await downloadFile(result.downloadUrl, result.fileName ?? fileName);
      } else {
        setError(result.message ?? "Download failed");
      }
    } catch (e: any) {
      setError(e.message ?? "Download failed");
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  }

  async function handleCouponRedeem() {
    if (!couponInput.trim()) {
      setError("Please enter a coupon code");
      return;
    }

    setIsLoading(true);
    setError("");
    setProgress(0);

    try {
      const result = await api.rpc<{ success: boolean; downloadUrl?: string; fileName?: string; message?: string }>(
        "redeemCouponAndDownload",
        marketplacePostId,
        couponInput
      );

      if (result.success && result.downloadUrl) {
        setDownloadCount((c) => c + 1);
        setCouponInput("");
        await downloadFile(result.downloadUrl, result.fileName ?? fileName);
      } else {
        setError(result.message ?? "Invalid coupon");
      }
    } catch (e: any) {
      setError(e.message ?? "Redeem failed");
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  }

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 8,
        backgroundColor: "#faf5ff",
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: "#e9d5ff",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#7c3aed" }}>
          Digital File
        </Text>
        <View
          style={{
            backgroundColor: isFree ? "#dcfce7" : "#fef3c7",
            borderRadius: 10,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: isFree ? "#16a34a" : "#d97706",
            }}
          >
            {isFree ? "Free" : "Coupon required"}
          </Text>
        </View>
      </View>

      <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
        {fileName} ({formatFileSize(fileSize)})
      </Text>

      {/* Download progress bar */}
      {isLoading && progress > 0 && (
        <View style={{ marginTop: 8 }}>
          <View
            style={{
              height: 4,
              backgroundColor: "#e5e7eb",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: "100%",
                width: `${Math.round(progress * 100)}%`,
                backgroundColor: "#c026d3",
                borderRadius: 2,
              }}
            />
          </View>
          <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
      )}

      {/* Owner info */}
      {isOwner && (
        <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>
          Downloads: {downloadCount}
        </Text>
      )}

      {/* Free download button */}
      {isFree && (
        <TouchableOpacity
          onPress={handleFreeDownload}
          disabled={isLoading}
          style={{
            backgroundColor: "#c026d3",
            borderRadius: 10,
            paddingVertical: 10,
            alignItems: "center",
            marginTop: 10,
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
              Download
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Coupon-locked download */}
      {!isFree && !isOwner && (
        <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
          <TextInput
            value={couponInput}
            onChangeText={(t) => {
              setCouponInput(t);
              setError("");
            }}
            placeholder="Enter coupon code"
            autoCapitalize="characters"
            style={{
              flex: 1,
              backgroundColor: "#fff",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#e5e7eb",
              padding: 8,
              fontSize: 14,
              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
            }}
          />
          <TouchableOpacity
            onPress={handleCouponRedeem}
            disabled={isLoading}
            style={{
              backgroundColor: "#c026d3",
              borderRadius: 8,
              paddingHorizontal: 14,
              justifyContent: "center",
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Redeem</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {error ? (
        <Text style={{ color: "#ef4444", fontSize: 12, marginTop: 6 }}>{error}</Text>
      ) : null}
    </View>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
