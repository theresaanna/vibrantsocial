import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";

export default function SettingsScreen() {
  const { logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => logout() },
    ]);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fff" }}>
      <Section title="Account">
        <MenuItem label="Edit Profile" onPress={() => router.push("/(stack)/settings/edit-profile")} />
        <MenuItem label="Customize Profile" onPress={() => router.push("/(stack)/settings/customize-profile")} />
        <MenuItem label="Change Password" onPress={() => router.push("/(stack)/settings/change-password")} />
        <MenuItem label="Two-Factor Authentication" onPress={() => router.push("/(stack)/settings/two-factor")} />
        <MenuItem label="Linked Accounts" onPress={() => {}} />
        <MenuItem label="Email Verification" onPress={() => router.push("/(stack)/verify-email")} />
        <MenuItem label="Phone Verification" onPress={() => router.push("/(stack)/verify-phone")} />
        <MenuItem label="Age Verification" onPress={() => router.push("/(stack)/age-verify")} />
      </Section>

      <Section title="Privacy">
        <MenuItem label="Blocked Users" onPress={() => router.push("/(stack)/settings/blocked")} />
        <MenuItem label="Muted Users" onPress={() => router.push("/(stack)/settings/muted")} />
      </Section>

      <Section title="Social">
        <MenuItem label="Close Friends" onPress={() => router.push("/(stack)/close-friends")} />
        <MenuItem label="Tag Subscriptions" onPress={() => router.push("/(stack)/tag-subscriptions")} />
        <MenuItem label="Links Page" onPress={() => router.push("/(stack)/profile-links")} />
      </Section>

      <Section title="Appearance">
        <MenuItem label="Theme & Style" onPress={() => router.push("/(stack)/theme")} />
        <MenuItem label="App Theme" onPress={() => router.push("/(stack)/settings/theme")} />
      </Section>

      <Section title="Notifications">
        <MenuItem label="Push Notifications" onPress={() => {}} />
        <MenuItem label="Email Notifications" onPress={() => {}} />
      </Section>

      <Section title="Subscription">
        <MenuItem label="VibrantSocial Premium" onPress={() => router.push("/(stack)/premium")} />
      </Section>

      <Section title="Support">
        <MenuItem label="Help & Support" onPress={() => router.push("/(stack)/support")} />
        <MenuItem label="Appeal an Action" onPress={() => router.push("/(stack)/appeal")} />
        <MenuItem label="Privacy Policy" onPress={() => router.push("/(stack)/policy/privacy")} />
        <MenuItem label="Terms of Service" onPress={() => router.push("/(stack)/policy/tos")} />
      </Section>

      <View style={{ padding: 16 }}>
        <TouchableOpacity
          onPress={handleLogout}
          style={{
            backgroundColor: "#fef2f2",
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#ef4444", fontWeight: "600", fontSize: 16 }}>Log out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={{ paddingHorizontal: 16, marginBottom: 8, fontSize: 13, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase" }}>
        {title}
      </Text>
      <View style={{ backgroundColor: "#fff" }}>{children}</View>
    </View>
  );
}

function MenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
      }}
    >
      <Text style={{ fontSize: 16 }}>{label}</Text>
      <Text style={{ color: "#d1d5db", fontSize: 18 }}>›</Text>
    </TouchableOpacity>
  );
}
