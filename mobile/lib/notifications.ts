import * as Notifications from "expo-notifications";
import * as Device from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and send the Expo push token to the server.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#c026d3",
    });
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId: Device.default.expoConfig?.extra?.eas?.projectId,
  });

  // Register token with server
  await api.post("/api/notifications/expo-token", { token }).catch(() => {
    // Non-critical — notification delivery will fail but app works
  });

  return token;
}

/**
 * Unregister push token from the server (e.g., on logout).
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: Device.default.expoConfig?.extra?.eas?.projectId,
    });
    await api.post("/api/notifications/expo-token/remove", { token });
  } catch {
    // Best-effort
  }
}
