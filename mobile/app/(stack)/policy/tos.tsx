import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import * as WebBrowser from "expo-web-browser";

const TOS_URL = "https://vibrantsocial.app/tos";

export default function TermsOfServiceScreen() {
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    WebBrowser.openBrowserAsync(TOS_URL)
      .catch(() => setFallback(true))
      .then((result) => {
        if (result && result.type === "cancel") {
          setFallback(true);
        }
      });
  }, []);

  if (!fallback) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#c026d3" />
        <Text style={{ marginTop: 16, color: "#6b7280" }}>Opening terms of service...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fff" }} contentContainerStyle={{ padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 16 }}>Terms of Service</Text>
      <Text style={{ color: "#6b7280", lineHeight: 22, marginBottom: 16 }}>
        By using VibrantSocial, you agree to these Terms of Service. Please read them carefully
        before using our platform.
      </Text>
      <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 8 }}>Acceptable Use</Text>
      <Text style={{ color: "#6b7280", lineHeight: 22, marginBottom: 16 }}>
        You agree to use VibrantSocial in compliance with all applicable laws and regulations.
        You may not use the platform to harass, abuse, or harm others, or to distribute illegal
        or harmful content.
      </Text>
      <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 8 }}>Your Content</Text>
      <Text style={{ color: "#6b7280", lineHeight: 22, marginBottom: 16 }}>
        You retain ownership of content you post. By posting, you grant VibrantSocial a license
        to display and distribute your content within the platform.
      </Text>
      <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 8 }}>Contact Us</Text>
      <Text style={{ color: "#6b7280", lineHeight: 22, marginBottom: 16 }}>
        For the full terms of service, please visit vibrantsocial.app/tos. If you have questions,
        contact us at legal@vibrantsocial.app.
      </Text>
    </ScrollView>
  );
}
