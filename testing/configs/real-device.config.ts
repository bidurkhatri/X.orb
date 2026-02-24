/**
 * Real Device Testing Configuration
 * Setup for testing on real devices using BrowserStack, Sauce Labs, or similar services
 */

import { config as DetoxConfig } from 'detox';
import { device } from 'detox/runners/jest';

const realDeviceConfig = {
  // BrowserStack Configuration
  browserstack: {
    user: process.env.BROWSERSTACK_USERNAME,
    key: process.env.BROWSERSTACK_ACCESS_KEY,
    server: 'https://hub-cloud.browserstack.com/wd/hub',
    
    // iOS Real Devices
    'ios.real.iPhone14': {
      platformName: 'iOS',
      deviceName: 'iPhone 14',
      udid: process.env.BROWSERSTACK_IOS_UDID,
      platformVersion: '16.0',
      automationName: 'XCUITest',
      app: './ios/build/Build/Products/Release-iphoneos/SylOS.ipa',
      appWaitActivity: 'com.sylos.MainActivity',
      otherApps: [],
      networkProfile: '4g',
      acceptInsecureCerts: true,
      browserName: '',
    },
    
    'ios.real.iPhone13': {
      platformName: 'iOS',
      deviceName: 'iPhone 13',
      udid: process.env.BROWSERSTACK_IOS_UDID_13,
      platformVersion: '15.0',
      automationName: 'XCUITest',
      app: './ios/build/Build/Products/Release-iphoneos/SylOS.ipa',
    },
    
    'ios.real.iPad': {
      platformName: 'iOS',
      deviceName: 'iPad Pro',
      udid: process.env.BROWSERSTACK_IPAD_UDID,
      platformVersion: '16.0',
      automationName: 'XCUITest',
      app: './ios/build/Build/Products/Release-iphoneos/SylOS.ipa',
    },
    
    // Android Real Devices
    'android.real.galaxyS23': {
      platformName: 'Android',
      deviceName: 'Samsung Galaxy S23',
      udid: process.env.BROWSERSTACK_ANDROID_UDID_S23,
      platformVersion: '13.0',
      automationName: 'UiAutomator2',
      app: './android/app/build/outputs/apk/release/app-release.apk',
      appWaitActivity: 'com.sylos.MainActivity',
      otherApps: [],
      networkProfile: '4g',
    },
    
    'android.real.pixel7': {
      platformName: 'Android',
      deviceName: 'Google Pixel 7',
      udid: process.env.BROWSERSTACK_ANDROID_UDID_PIXEL7,
      platformVersion: '13.0',
      automationName: 'UiAutomator2',
      app: './android/app/build/outputs/apk/release/app-release.apk',
    },
    
    'android.real.onePlus': {
      platformName: 'Android',
      deviceName: 'OnePlus 9',
      udid: process.env.BROWSERSTACK_ANDROID_UDID_ONEPLUS,
      platformVersion: '12.0',
      automationName: 'UiAutomator2',
      app: './android/app/build/outputs/apk/release/app-release.apk',
    },
  },
  
  // Sauce Labs Configuration
  saucelabs: {
    user: process.env.SAUCELABS_USERNAME,
    key: process.env.SAUCELABS_ACCESS_KEY,
    server: 'https://ondemand.saucelabs.com:443/wd/hub',
    
    'ios.real.iPhone14.sauce': {
      platformName: 'iOS',
      deviceName: 'iPhone 14 Real Device',
      udid: process.env.SAUCELABS_IOS_UDID,
      platformVersion: '16.0',
      automationName: 'XCUITest',
      app: './ios/build/Build/Products/Release-iphoneos/SylOS.ipa',
      name: 'SylOS iPhone 14 Test',
      build: `SylOS iOS ${new Date().toISOString()}`,
      'tunnel-identifier': process.env.SAUCELABS_TUNNEL_ID,
    },
    
    'android.real.galaxyS23.sauce': {
      platformName: 'Android',
      deviceName: 'Samsung Galaxy S23 SamsungBrowser',
      udid: process.env.SAUCELABS_ANDROID_UDID,
      platformVersion: '13.0',
      automationName: 'UiAutomator2',
      app: './android/app/build/outputs/apk/release/app-release.apk',
      name: 'SylOS Galaxy S23 Test',
      build: `SylOS Android ${new Date().toISOString()}`,
      'tunnel-identifier': process.env.SAUCELABS_TUNNEL_ID,
    },
  },
  
  // AWS Device Farm Configuration
  awsDeviceFarm: {
    projectArn: process.env.AWS_DF_PROJECT_ARN,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: 'us-west-2',
    
    'ios.real.devicefarm': {
      platformName: 'iOS',
      deviceName: 'iPhone 14',
      automationName: 'XCUITest',
      app: './ios/build/Build/Products/Release-iphoneos/SylOS.ipa',
      test: './ios/SylOSUITests-Runner.ipa',
    },
    
    'android.real.devicefarm': {
      platformName: 'Android',
      deviceName: 'Samsung Galaxy S23',
      automationName: 'UiAutomator2',
      app: './android/app/build/outputs/apk/release/app-release.apk',
      test: './android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
    },
  },
};

// Test execution configurations
export const realDeviceTestConfigs = {
  // Full device matrix test
  fullMatrix: {
    devices: [
      'ios.real.iPhone14',
      'ios.real.iPhone13',
      'ios.real.iPad',
      'android.real.galaxyS23',
      'android.real.pixel7',
      'android.real.onePlus',
    ],
    parallel: true,
    retryCount: 2,
    timeout: 300000, // 5 minutes
  },
  
  // Core devices test
  coreDevices: {
    devices: [
      'ios.real.iPhone14',
      'android.real.galaxyS23',
    ],
    parallel: true,
    retryCount: 1,
    timeout: 180000, // 3 minutes
  },
  
  // Quick smoke test
  quickSmoke: {
    devices: [
      'ios.real.iPhone14',
    ],
    parallel: false,
    retryCount: 0,
    timeout: 120000, // 2 minutes
  },
};

// Environment setup
export const setupRealDeviceEnvironment = () => {
  // Validate required environment variables
  const requiredEnvVars = {
    browserstack: ['BROWSERSTACK_USERNAME', 'BROWSERSTACK_ACCESS_KEY'],
    saucelabs: ['SAUCELABS_USERNAME', 'SAUCELABS_ACCESS_KEY'],
    aws: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DF_PROJECT_ARN'],
  };
  
  const provider = process.env.DEVICE_TESTING_PROVIDER || 'browserstack';
  
  switch (provider) {
    case 'browserstack':
      requiredEnvVars.browserstack.forEach(envVar => {
        if (!process.env[envVar]) {
          throw new Error(`Missing required environment variable: ${envVar}`);
        }
      });
      break;
      
    case 'saucelabs':
      requiredEnvVars.saucelabs.forEach(envVar => {
        if (!process.env[envVar]) {
          throw new Error(`Missing required environment variable: ${envVar}`);
        }
      });
      break;
      
    case 'aws':
      requiredEnvVars.aws.forEach(envVar => {
        if (!process.env[envVar]) {
          throw new Error(`Missing required environment variable: ${envVar}`);
        }
      });
      break;
      
    default:
      throw new Error(`Unsupported device testing provider: ${provider}`);
  }
  
  console.log(`Real device testing environment configured for ${provider}`);
};

// Device capabilities
export const getDeviceCapabilities = (deviceName: string, provider: string = 'browserstack') => {
  const capabilities = realDeviceConfig[provider as keyof typeof realDeviceConfig];
  
  if (!capabilities || !capabilities[deviceName as keyof typeof capabilities]) {
    throw new Error(`Device configuration not found: ${deviceName}`);
  }
  
  return capabilities[deviceName as keyof typeof capabilities];
};

// Parallel test runner for real devices
export const runParallelDeviceTests = async (
  deviceConfigs: string[], 
  testConfig: any,
  testFunction: (deviceName: string) => Promise<void>
) => {
  const results: { device: string; success: boolean; error?: string }[] = [];
  
  const promises = deviceConfigs.map(async (deviceName) => {
    try {
      console.log(`Starting test on device: ${deviceName}`);
      await testFunction(deviceName);
      results.push({ device: deviceName, success: true });
      console.log(`Test completed successfully on device: ${deviceName}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({ device: deviceName, success: false, error: errorMessage });
      console.error(`Test failed on device ${deviceName}:`, errorMessage);
    }
  });
  
  await Promise.allSettled(promises);
  
  return results;
};

// Device-specific test configurations
export const deviceSpecificConfigs = {
  // iOS-specific configurations
  ios: {
    appInstallTimeout: 180000,
    appUninstallTimeout: 60000,
    launchArgs: {
      '-detoxEnableSynchronization': '0', // Disable animations for testing
      '-detoxPrintBusyIdleResources': 'YES',
    },
  },
  
  // Android-specific configurations  
  android: {
    appInstallTimeout: 180000,
    appUninstallTimeout: 60000,
    launchArgs: {
      'automationName': 'UiAutomator2',
    },
  },
};

// Real device test scenarios
export const realDeviceTestScenarios = {
  basicFunctionality: [
    'App launches successfully',
    'Lock screen appears',
    'Unlock functionality works',
    'Desktop interface loads',
    'Wallet app opens',
    'PoP tracker opens',
    'Navigation works',
    'Back button works',
  ],
  
  blockchainIntegration: [
    'Wallet connection established',
    'Balance displayed correctly',
    'Transaction signing works',
    'Network switching works',
    'IPFS upload/download works',
    'PoP score updates',
  ],
  
  performance: [
    'App launches within 5 seconds',
    'Memory usage is reasonable',
    'Battery impact is minimal',
    'No crashes during normal use',
    'Smooth animations and transitions',
  ],
  
  networkConditions: [
    'Works on 4G/LTE',
    'Works on 3G',
    'Works on WiFi',
    'Handles poor network gracefully',
    'Offline functionality works',
  ],
  
  deviceCompatibility: [
    'Different screen sizes',
    'Different resolutions',
    'Different iOS/Android versions',
    'Different manufacturers (Android)',
    'Home button vs gesture navigation',
  ],
};

// Test reporting for real devices
export const generateRealDeviceTestReport = (testResults: any[]) => {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: testResults.length,
      passed: testResults.filter(r => r.success).length,
      failed: testResults.filter(r => !r.success).length,
      passRate: 0,
    },
    details: testResults.map(result => ({
      device: result.device,
      status: result.success ? 'PASSED' : 'FAILED',
      error: result.error,
      timestamp: new Date().toISOString(),
    })),
  };
  
  report.summary.passRate = (report.summary.passed / report.summary.total) * 100;
  
  return report;
};

export default realDeviceConfig;
