import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import * as WebBrowser from "expo-web-browser";

const PRIVACY_URL = "https://vibrantsocial.app/privacy";

export default function PrivacyPolicyScreen() {
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    WebBrowser.openBrowserAsync(PRIVACY_URL)
      .catch(() => setFallback(true))
      .then((result) => {
        // If the browser was dismissed, we stay on the fallback
        if (result && result.type === "cancel") {
          setFallback(true);
        }
      });
  }, []);

  if (!fallback) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#c026d3" />
        <Text style={{ marginTop: 16, color: "#6b7280" }}>Opening privacy policy...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fff" }} contentContainerStyle={{ padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 16 }}>Privacy Policy</Text>
      <Text style={{ color: "#6b7280", lineHeight: 22, marginBottom: 16 }}>
        VibrantSocial is committed to protecting your privacy. This policy describes how we collect,
        use, and share information about you when you use our services.
      </Text>
      <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 8 }}>Information We Collect</Text>
      <Text style={{ color: "#6b7280", lineHeight: 22, marginBottom: 16 }}>
        We collect information you provide directly, such as when you create an account, update your
        profile, post content, or communicate with other users. This includes your name, email,
        phone number, and profile information.
      </Text>
      <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 8 }}>How We Use Your Information</Text>
      <Text style={{ color: "#6b7280", lineHeight: 22, marginBottom: 16 }}>
        We use your information to provide and improve our services, personalize your experience,
        communicate with you, and ensure the safety and security of our platform.
      </Text>
      <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 8 }}>Contact Us</Text>
      <Text style={{ color: "#6b7280", lineHeight: 22, marginBottom: 16 }}>
        For the full privacy policy, please visit vibrantsocial.app/privacy. If you have questions,
        contact us at privacy@vibrantsocial.app.
      </Text>
    </ScrollView>
  );
}
