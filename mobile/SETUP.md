# VibrantSocial Mobile App Setup

## Prerequisites

- Node.js 20.19+ (Prisma 7 requirement) or 22.12+
- Expo CLI: `npm install -g eas-cli`
- Apple Developer Account (for iOS)
- Google Play Developer Account (for Android)

## First-time setup

### 1. Link to EAS

```bash
cd mobile
eas init
```

This creates an EAS project and updates `app.config.ts` with your project ID.

### 2. Configure App Store credentials

#### iOS (App Store Connect)

1. Get your Apple Team ID from [developer.apple.com/account](https://developer.apple.com/account)
2. Create an App ID with bundle identifier `app.vibrantsocial.mobile`
3. Create an app in App Store Connect
4. Update `eas.json`:
   - `submit.production.ios.appleId` → your Apple ID email
   - `submit.production.ios.ascAppId` → App Store Connect app ID (numeric)
   - `submit.production.ios.appleTeamId` → your team ID

Or use EAS-managed credentials (recommended):
```bash
eas credentials
```

#### Android (Google Play Console)

1. Create an app in Google Play Console
2. Create a service account with publish permissions
3. Download the JSON key file and save as `mobile/google-services.json`
4. The path is already configured in `eas.json`

### 3. Environment variables

Create `mobile/.env`:
```
EXPO_PUBLIC_API_URL=https://vibrantsocial.app
```

For development, point to your local server:
```
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
```

### 4. Run locally

```bash
cd mobile
npx expo start
```

Scan the QR code with Expo Go, or press `i` for iOS simulator / `a` for Android emulator.

### 5. Build for stores

```bash
# Preview build (TestFlight / internal testing)
eas build --profile preview --platform all

# Production build
eas build --profile production --platform all

# Submit to stores
eas submit --platform all
```

## Push Notifications

Push notifications require a physical device. They won't work on simulators.

The server automatically sends Expo push notifications alongside web push.
The mobile app registers its push token on login (see `lib/notifications.ts`).
