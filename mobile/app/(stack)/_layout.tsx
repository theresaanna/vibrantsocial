import { Stack } from "expo-router";

export default function StackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
      }}
    >
      <Stack.Screen name="post/[id]/index" options={{ title: "Post" }} />
      <Stack.Screen name="post/[id]/likes" options={{ title: "Likes" }} />
      <Stack.Screen name="post/[id]/reposts" options={{ title: "Reposts" }} />
      <Stack.Screen name="post/[id]/quote" options={{ title: "Quote Post" }} />
      <Stack.Screen name="[username]/index" options={{ title: "Profile" }} />
      <Stack.Screen name="[username]/followers" options={{ title: "Followers" }} />
      <Stack.Screen name="[username]/following" options={{ title: "Following" }} />
      <Stack.Screen name="[username]/friends" options={{ title: "Friends" }} />
      <Stack.Screen name="settings/index" options={{ title: "Settings" }} />
      <Stack.Screen name="settings/edit-profile" options={{ title: "Edit Profile" }} />
      <Stack.Screen name="settings/change-password" options={{ title: "Change Password" }} />
      <Stack.Screen name="settings/two-factor" options={{ title: "Two-Factor Auth" }} />
      <Stack.Screen name="settings/blocked" options={{ title: "Blocked Users" }} />
      <Stack.Screen name="settings/muted" options={{ title: "Muted Users" }} />
      <Stack.Screen name="settings/theme" options={{ title: "Appearance" }} />
      <Stack.Screen name="theme/index" options={{ title: "Theme & Style" }} />
      <Stack.Screen name="settings/customize-profile" options={{ title: "Customize Profile" }} />
      <Stack.Screen name="marketplace/index" options={{ title: "Marketplace" }} />
      <Stack.Screen name="marketplace/[id]" options={{ title: "Listing" }} />
      <Stack.Screen name="marketplace/create" options={{ title: "Create Listing" }} />
      <Stack.Screen name="lists/index" options={{ title: "Lists" }} />
      <Stack.Screen name="lists/[id]" options={{ title: "List" }} />
      <Stack.Screen name="friend-requests" options={{ title: "Friend Requests" }} />
      <Stack.Screen name="bookmarks" options={{ title: "Bookmarks" }} />
      <Stack.Screen name="communities" options={{ title: "Communities" }} />
      <Stack.Screen name="statuses/index" options={{ title: "Statuses" }} />
      <Stack.Screen name="statuses/[username]" options={{ title: "User Statuses" }} />
      <Stack.Screen name="tag/[name]" options={{ title: "Tag" }} />
      <Stack.Screen name="close-friends" options={{ title: "Close Friends" }} />
      <Stack.Screen name="profile-links" options={{ title: "Links Page" }} />
      <Stack.Screen name="[username]/links" options={{ title: "Links" }} />
      <Stack.Screen name="tag-subscriptions" options={{ title: "Tag Subscriptions" }} />
      <Stack.Screen name="premium" options={{ title: "Premium" }} />
      <Stack.Screen name="verify-email" options={{ title: "Verify Email" }} />
      <Stack.Screen name="verify-phone" options={{ title: "Verify Phone" }} />
      <Stack.Screen name="age-verify" options={{ title: "Age Verification" }} />
      <Stack.Screen name="complete-profile" options={{ title: "Complete Profile" }} />
      <Stack.Screen name="policy/privacy" options={{ title: "Privacy Policy" }} />
      <Stack.Screen name="policy/tos" options={{ title: "Terms of Service" }} />
      <Stack.Screen name="support" options={{ title: "Help & Support" }} />
      <Stack.Screen name="appeal" options={{ title: "Appeal" }} />
    </Stack>
  );
}
