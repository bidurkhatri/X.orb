const config = {
  testRunner: {
    args: {
      config: 'jest.config.js',
      runInBand: true,
      testTimeout: 120000,
    },
    jest: {
      setupFilesAfterEnv: ['<rootDir>/configs/detox.setup.js'],
    },
  },
  
  configurations: {
    'ios.sim.debug': {
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/SylOS.app',
      build: 'xcodebuild -workspace ios/SylOS.xcworkspace -scheme SylOS -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
      type: 'ios.simulator',
      device: {
        type: 'iPhone 14 Pro',
        os: 'iOS 16.0',
      },
      appium: {
        fullReset: false,
        noReset: true,
      },
    },
    
    'ios.sim.release': {
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/SylOS.app',
      build: 'xcodebuild -workspace ios/SylOS.xcworkspace -scheme SylOS -configuration Release -sdk iphonesimulator -derivedDataPath ios/build',
      type: 'ios.simulator',
      device: {
        type: 'iPhone 14 Pro',
        os: 'iOS 16.0',
      },
      appium: {
        fullReset: false,
        noReset: true,
      },
    },
    
    'android.sim.debug': {
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
      type: 'android.emulator',
      device: {
        avdName: 'Nexus_5_API_30',
        options: {
          audio: false,
        },
      },
      appium: {
        fullReset: false,
        noReset: true,
      },
    },
    
    'android.sim.release': {
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      build: 'cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
      type: 'android.emulator',
      device: {
        avdName: 'Nexus_5_API_30',
        options: {
          audio: false,
        },
      },
      appium: {
        fullReset: false,
        noReset: true,
      },
    },
    
    'android.emu.debug': {
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_4_API_30',
        options: {
          audio: false,
        },
      },
    },
  },
  
  artifacts: {
    pathBuilder: './artifacts',
    shouldRecordVideo: 'failing',
    shouldRecordPerformance: 'failing',
    shouldTakeAutomaticSnapshots: 'failing',
    video: {
      android: {
        bitRate: 2000000,
        frameskip: 10,
        timeLimit: 180,
      },
      ios: {
        codec: 'h264',
        timeLimit: 180,
      },
    },
  },
  
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/SylOS.app',
      build: 'xcodebuild -workspace ios/SylOS.xcworkspace -scheme SylOS -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
    
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/SylOS.app',
      build: 'xcodebuild -workspace ios/SylOS.xcworkspace -scheme SylOS -configuration Release -sdk iphonesimulator -derivedDataPath ios/build',
    },
    
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
    },
    
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      build: 'cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
    },
  },
};

module.exports = config;