import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "VibrantSocial",
  slug: "vibrantsocial",
  scheme: "vibrantsocial",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#c026d3",
  },
  ios: {
    bundleIdentifier: "com.vibrantsocial.app",
    supportsTablet: true,
    associatedDomains: ["applinks:vibrantsocial.app"],
    infoPlist: {
      NSCameraUsageDescription: "VibrantSocial needs camera access to take photos and videos for posts and messages.",
      NSPhotoLibraryUsageDescription: "VibrantSocial needs photo library access to share images in posts and messages.",
      NSMicrophoneUsageDescription: "VibrantSocial needs microphone access to record voice notes.",
      NSPhotoLibraryAddUsageDescription: "VibrantSocial needs permission to save photos to your library.",
    },
  },
  android: {
    package: "com.vibrantsocial.app",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#c026d3",
    },
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "vibrantsocial.app",
            pathPrefix: "/",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#c026d3",
      },
    ],
    "expo-image-picker",
    "expo-camera",
    "expo-av",
    "expo-document-picker",
    "expo-font",
  ],
  experiments: {
    typedRoutes: false,
  },
  extra: {
    eas: {
      projectId: "your-eas-project-id",
    },
  },
});
