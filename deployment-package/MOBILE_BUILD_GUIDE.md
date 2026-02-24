# Mobile App Build Guide

> Complete guide for building and deploying the SylOS mobile application

## Overview

The SylOS mobile app is built with React Native and Expo, providing a cross-platform solution for iOS and Android. This guide covers development setup, building processes, and deployment strategies.

## Prerequisites

### System Requirements

#### Development
- **OS:** macOS 10.15+, Windows 10+, or Ubuntu 18.04+
- **Memory:** 8GB RAM minimum (16GB recommended)
- **Storage:** 10GB free space
- **Node.js:** 18.0.0+ (use nvm for easy management)

#### Building for Production
- **iOS Builds:** macOS with Xcode 14+
- **Android Builds:** Any OS with Android Studio
- **Memory:** 16GB RAM for faster builds
- **Storage:** 20GB+ free space

### Required Software

#### All Platforms
```bash
# Node.js (via nvm - recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Git
git --version

# Watchman (for file watching)
npm install -g watchman
```

#### macOS (iOS Development)
```bash
# Xcode (from App Store)
# CocoaPods
sudo gem install cocoapods

# iOS Simulator (included with Xcode)
# Fastlane (optional, for automation)
sudo gem install fastlane
```

#### Windows (Android Development)
```bash
# Android Studio (download from developer.android.com)
# Java Development Kit 11
# Android SDK
# Android Emulator
```

#### Linux (Android Development)
```bash
# Java Development Kit
sudo apt install openjdk-11-jdk

# Android Studio (via snap)
sudo snap install android-studio --classic

# Or download from developer.android.com
```

## Project Structure

```
sylos-mobile/
├── app/                    # Expo Router app directory
│   ├── (tabs)/            # Tab navigation
│   ├── _layout.tsx        # Root layout
│   ├── index.tsx          # Home screen
│   └── ...
├── assets/                # Static assets
│   ├── images/            # App icons, images
│   └── fonts/             # Custom fonts
├── src/                   # Source code
│   ├── components/        # Reusable components
│   ├── features/          # Feature modules
│   ├── hooks/             # Custom hooks
│   ├── services/          # API services
│   ├── types/             # TypeScript types
│   └── utils/             # Utility functions
├── package.json           # Dependencies
├── app.json              # Expo configuration
├── tsconfig.json         # TypeScript config
└── eas.json              # EAS Build configuration
```

## Development Setup

### 1. Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd sylos-workspace/sylos-mobile

# Install dependencies
npm install

# Initialize Expo
npx expo install --fix

# Start development server
npx expo start
```

### 2. Environment Configuration

Create `app/.env` (for local development):

```bash
# API Configuration
API_BASE_URL=http://localhost:3000/api
WS_BASE_URL=ws://localhost:3000

# Blockchain Configuration
BLOCKCHAIN_NETWORK=localhost
BLOCKCHAIN_RPC_URL=http://localhost:8545
BLOCKCHAIN_CHAIN_ID=31337

# Feature Flags
ENABLE_BLOCKCHAIN=true
ENABLE_FILE_MANAGER=true
ENABLE_NOTIFICATIONS=true
ENABLE_BIOMETRIC_AUTH=true

# Development
DEBUG_MODE=true
LOG_LEVEL=debug
ENABLE_REDUX_DEVTOOLS=true
```

### 3. Running the App

#### Development Server
```bash
# Start the development server
npx expo start

# Options:
# - Press 'a' for Android emulator
# - Press 'i' for iOS simulator
# - Press 'r' to reload
# - Press 'm' to open menu
# - Press 'j' to open debugger
```

#### Physical Device Testing

**iOS (Physical Device):**
1. Install "Expo Go" from App Store
2. Connect iPhone to computer via USB
3. Trust the computer on your iPhone
4. Run `npx expo start` and scan QR code

**Android (Physical Device):**
1. Install "Expo Go" from Google Play Store
2. Enable Developer Options:
   - Settings → About Phone → Tap "Build Number" 7 times
3. Enable USB Debugging:
   - Settings → Developer Options → USB Debugging
4. Run `npx expo start` and scan QR code

## Building for Development

### Development Build

```bash
# Create a development build (includes native modules)
npx expo run:android    # For Android
npx expo run:ios       # For iOS (macOS only)
```

### Preview Build

```bash
# Create a preview build (production-like, no dev tools)
eas build --profile preview --platform android
eas build --profile preview --platform ios
```

## Building for Production

### Using EAS Build (Recommended)

#### 1. Install EAS CLI
```bash
npm install -g @expo/cli eas-cli
```

#### 2. Login to Expo
```bash
eas login
```

#### 3. Configure EAS Build

Create `eas.json`:

```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "simulator": false
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

#### 4. Production Builds

**Android (APK):**
```bash
# Build APK
eas build --profile production --platform android

# Build AAB (for Play Store)
eas build --profile production --platform android --no-wait
```

**iOS:**
```bash
# Build for TestFlight
eas build --profile production --platform ios

# Build for App Store (requires paid developer account)
eas build --profile production --platform ios --no-wait
```

### Building Locally

#### Android

**APK Build:**
```bash
# Prebuild Android project
npx expo prebuild --platform android

# Navigate to Android directory
cd android

# Build APK
./gradlew assembleRelease

# APK will be in: android/app/build/outputs/apk/release/
```

**AAB Build:**
```bash
# Build AAB
cd android
./gradlew bundleRelease

# AAB will be in: android/app/build/outputs/bundle/release/
```

#### iOS (macOS Only)

**Xcode Build:**
```bash
# Prebuild iOS project
npx expo prebuild --platform ios

# Open in Xcode
open ios/SylOS.xcworkspace

# In Xcode:
# 1. Select your team (developer account required)
# 2. Set bundle identifier
# 3. Select device/simulator
# 4. Product → Archive
```

**Command Line (Basic):**
```bash
# Install CocoaPods dependencies
cd ios
pod install
cd ..

# Build for simulator
xcodebuild -workspace ios/SylOS.xcworkspace -scheme SylOS -configuration Release -sdk iphonesimulator
```

## Platform-Specific Configuration

### Android Configuration

#### Update `app.json` (Android Section)
```json
{
  "expo": {
    "android": {
      "package": "com.sylos.mobile",
      "versionCode": 1,
      "googleServicesFile": "./google-services.json",
      "permissions": [
        "CAMERA",
        "WRITE_EXTERNAL_STORAGE",
        "READ_EXTERNAL_STORAGE",
        "INTERNET",
        "NETWORK_STATE",
        "WAKE_LOCK",
        "VIBRATE",
        "USE_BIOMETRIC",
        "USE_FINGERPRINT"
      ],
      "config": {
        "googleMobileAdsAppId": "ca-app-pub-xxx~xxx"
      }
    }
  }
}
```

#### Android Manifest (`android/app/src/main/AndroidManifest.xml`)
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.USE_BIOMETRIC" />
    
    <!-- Features -->
    <uses-feature android:name="android.hardware.camera" android:required="true" />
    <uses-feature android:name="android.hardware.fingerprint" android:required="false" />
    
    <application>
        <!-- Main Activity -->
        <activity
            android:name=".MainActivity"
            android:label="@string/app_name"
            android:configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode"
            android:launchMode="singleTop"
            android:windowSoftInputMode="adjustResize"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

### iOS Configuration

#### Update `app.json` (iOS Section)
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.sylos.mobile",
      "buildNumber": "1",
      "supportsTablet": true,
      "infoPlist": {
        "NSCameraUsageDescription": "SylOS needs camera access for QR code scanning and photo uploads",
        "NSPhotoLibraryUsageDescription": "SylOS needs photo library access to attach images",
        "NSFaceIDUsageDescription": "SylOS uses Face ID for secure authentication",
        "LSApplicationQueriesSchemes": ["metamask", "trustwallet"]
      },
      "entitlements": {
        "com.apple.developer.associated-domains": ["applinks:sylos.app"]
      }
    }
  }
}
```

#### iOS Info.plist (`ios/SylOS/Info.plist`)
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>SylOS uses location for blockchain transactions and DeFi features</string>
<key>NSCameraUsageDescription</key>
<string>SylOS needs camera access for QR code scanning and photo uploads</string>
<key>NSFaceIDUsageDescription</key>
<string>SylOS uses Face ID for secure authentication</string>
```

## Advanced Configuration

### Web3 Integration

#### Install Web3 Dependencies
```bash
npm install @web3-react/core @web3-react/injected-connector @web3-react/walletconnect-connector
npm install ethers @ethersproject/providers
```

#### Configure Wallet Connect
```javascript
// src/services/wallet.ts
import { WalletConnectConnector } from '@web3-react/walletconnect-connector'

export const walletConnect = new WalletConnectConnector({
  rpc: {
    1: process.env.MAINNET_RPC_URL,
    5: process.env.GOERLI_RPC_URL,
  },
  qrcode: true,
})
```

### Push Notifications

#### Setup with Expo
```bash
# Install Expo Notifications
npx expo install expo-notifications expo-device expo-crypto expo-constants
```

#### Configuration
```javascript
// src/services/notifications.ts
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'

async function registerForPushNotificationsAsync() {
  let token

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    })
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!')
      return
    }
    token = (await Notifications.getExpoPushTokenAsync()).data
    console.log('Push token:', token)
  }

  return token
}
```

### Biometric Authentication

```bash
# Install Expo Local Authentication
npx expo install expo-local-authentication
```

```javascript
// src/services/biometric.ts
import * as LocalAuthentication from 'expo-local-authentication'

export async function authenticate() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync()
  const isEnrolled = await LocalAuthentication.isEnrolledAsync()

  if (!hasHardware || !isEnrolled) {
    return false
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to access SylOS',
    fallbackLabel: 'Use Passcode',
  })

  return result.success
}
```

## Testing

### Unit Testing
```bash
# Install testing dependencies
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### E2E Testing (Detox)
```bash
# Install Detox
npm install --save-dev detox @config/detox

# Build for testing
detox build --configuration ios.sim.debug
detox build --configuration android.emu.debug

# Run E2E tests
detox test --configuration ios.sim.debug
detox test --configuration android.emu.debug
```

### Testing on Devices

#### Android
```bash
# Install on connected device
npx expo run:android --deviceId <device-id>

# Build and install APK
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

#### iOS
```bash
# Install on connected device
npx expo run:ios --deviceId <device-id>

# Build and install via Xcode
# Product → Destination → Your Device
# Product → Run
```

## Distribution

### Android Distribution

#### Google Play Store
1. **Build AAB:**
   ```bash
   eas build --profile production --platform android
   ```

2. **Submit to Play Store:**
   ```bash
   eas submit --platform android
   ```

3. **Manual Upload:**
   - Go to [Google Play Console](https://play.google.com/console)
   - Create new app
   - Upload AAB file
   - Complete store listing
   - Submit for review

#### Direct APK Distribution
```bash
# Build APK
eas build --profile production --platform android

# Distribute APK file directly
# Upload to your server/CDN
# Users can download and install directly
```

### iOS Distribution

#### TestFlight (Beta Testing)
```bash
# Build for TestFlight
eas build --profile production --platform ios

# Submit to TestFlight
eas submit --platform ios
```

#### App Store (Production)
```bash
# Build for App Store
eas build --profile production --platform ios

# Submit to App Store
eas submit --platform ios
```

#### Enterprise Distribution (Internal)
1. **Build with Enterprise Certificate:**
   - Requires Apple Developer Enterprise Program
   - Configure provisioning profiles for enterprise
   - Build and distribute internally

#### Ad Hoc Distribution
```bash
# Build for specific devices
# Add device UDIDs to developer portal
# Create Ad Hoc provisioning profile
# Build and install on registered devices
```

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/build-mobile.yml`:

```yaml
name: Build Mobile App

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build Android APK
        run: eas build --platform android --non-interactive
      
      - name: Upload APK
        uses: actions/upload-artifact@v3
        with:
          name: android-apk
          path: dist/*.apk

  build-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup Xcode
        uses: microsoft/setup-xcode@v1
      
      - name: Build iOS
        run: eas build --platform ios --non-interactive
      
      - name: Upload IPA
        uses: actions/upload-artifact@v3
        with:
          name: ios-ipa
          path: dist/*.ipa
```

### GitLab CI

Create `.gitlab-ci.yml`:

```yaml
stages:
  - build
  - test
  - deploy

variables:
  EAS_BUILD_PROFILE: preview

before_script:
  - npm ci
  - npx eas-cli whoami

build:android:
  stage: build
  image: node:18
  script:
    - eas build --platform android --non-interactive
  artifacts:
    paths:
      - dist/*.apk

build:ios:
  stage: build
  image: node:18
  only:
    - main
  script:
    - eas build --platform ios --non-interactive
  artifacts:
    paths:
      - dist/*.ipa

test:
  stage: test
  script:
    - npm test
    - npm run lint
```

## Performance Optimization

### App Size Reduction
```json
// app.json
{
  "expo": {
    "android": {
      "enableProguardInReleaseBuilds": true,
      "enableSeparateBuildPerCPUArchitecture": true
    },
    "ios": {
      "enableBitcode": true,
      "sdlInitTaskExcludeFrom": ["expo-splash-screen"]
    }
  }
}
```

### Bundle Analysis
```bash
# Install bundle analyzer
npm install --save-dev @expo/bundle-analyzer

# Analyze bundle size
npx expo-bundle-analyzer dist/index.bundle
```

### Performance Monitoring
```bash
# Install Flipper for debugging
# Install React Native Performance Monitor
# Use Expo's performance monitoring
```

## Troubleshooting

### Common Build Issues

#### Android Build Failures
```bash
# Clean build cache
cd android
./gradlew clean
cd ..
npx expo run:android

# Update Android SDK
sdkmanager --update
sdkmanager "build-tools;33.0.0"

# Fix Gradle issues
rm -rf android/.gradle
cd android && ./gradlew clean
```

#### iOS Build Failures
```bash
# Clean CocoaPods
cd ios
rm -rf Pods
rm Podfile.lock
pod install
cd ..

# Fix Xcode workspace
rm ios/Pods ios/SylOS.xcworkspace
npx expo prebuild --platform ios
pod install
```

#### Metro Issues
```bash
# Clear Metro cache
npx expo start --clear

# Reset Metro cache
npx react-native start --reset-cache

# Clear npm cache
npm start -- --reset-cache
```

### Network Issues
```bash
# Reset network
npx expo start --clear

# Use tunnel mode
npx expo start --tunnel

# Use LAN mode
npx expo start --lan
```

### Device-Specific Issues

#### Android Emulator
```bash
# Cold boot emulator
emulator -avd <avd_name> -wipe-data

# Check emulator status
adb devices

# Clear app data
adb shell pm clear com.sylos.mobile
```

#### iOS Simulator
```bash
# Reset simulator
Device → Erase All Content and Settings

# Rebuild app
npx expo run:ios
```

## Security Considerations

### Code Obfuscation
```bash
# Enable ProGuard for Android
# In android/app/build.gradle:
android {
    buildTypes {
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
}
```

### Secure Storage
```bash
# Use Expo SecureStore for sensitive data
npx expo install expo-secure-store

# For passwords, tokens, private keys
import * as SecureStore from 'expo-secure-store'
```

### Certificate Pinning
```javascript
// src/services/api.ts
import * as Network from 'expo-network'

// Implement certificate pinning for production
const ALLOWED_CERT_HASHES = [
  'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // Replace with actual hash
]
```

## Release Management

### Version Management
```bash
# Semantic versioning
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.1 -> 1.1.0
npm version major  # 1.1.0 -> 2.0.0
```

### Release Process
1. **Feature branches** → `develop`
2. **Develop** → `main` (release)
3. **Tag release** `v1.0.0`
4. **Build and distribute**
5. **Monitor and collect feedback**

### Release Notes
```markdown
# v1.0.0 - SylOS Mobile Launch

## 🚀 New Features
- Desktop-like experience on mobile
- Blockchain integration with wallet support
- File manager with cloud sync
- Desktop applications (Calculator, Notepad, etc.)

## 🔧 Improvements
- Enhanced performance
- Better battery optimization
- Improved security

## 🐛 Bug Fixes
- Fixed authentication issues
- Resolved file upload problems
- Improved stability

## 📱 Requirements
- iOS 13.0+ / Android API Level 21+
```

## Support and Resources

### Documentation
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [React Native Elements](https://reactnativeelements.com/)

### Community
- [Expo Discord](https://chat.expo.dev/)
- [React Native Community](https://github.com/react-native-community)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/react-native+expo)

### Tools
- [Expo Dev Tools](https://docs.expo.dev/debugging/tools/)
- [Flipper](https://fbflipper.com/)
- [Reactotron](https://github.com/infinitered/reactotron)

---

**📱 Ready to build!** Follow this guide to create production-ready mobile apps for SylOS.

For deployment automation, see [CI/CD Guide](./CI_CD_GUIDE.md)