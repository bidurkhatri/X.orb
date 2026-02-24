const detox = require('detox');
const adapter = require('detox/runners/jest/adapter');

jest.setTimeout(120000);
beforeAll(async () => {
  await adapter.beforeAll();
});

beforeEach(async () => {
  await adapter.beforeEach(test);
});

afterAll(async () => {
  await adapter.afterAll();
});

// Global test utilities for mobile
global.mobileTestUtils = {
  // Test data generators
  testUser: {
    email: 'test@sylos.com',
    password: 'testpassword123',
    name: 'Test User',
    walletAddress: '0x1234567890123456789012345678901234567890',
  },
  
  // Mock wallet data
  mockWallet: {
    address: '0x1234567890123456789012345678901234567890',
    balance: '1.5',
    network: 'Polygon PoS',
  },
  
  // Mock token data
  tokens: {
    SYLOS: {
      symbol: 'SYLOS',
      balance: '1000',
      price: '2.0',
      value: '2000',
    },
    wSYLOS: {
      symbol: 'wSYLOS',
      balance: '500',
      price: '2.2',
      value: '1100',
    },
  },
  
  // Mock PoP data
  popData: {
    score: 8547,
    tier: 'Diamond',
    weeklyReward: '145.5',
    tasks: [
      { id: 1, title: 'Complete DApp Integration', completed: true, points: 500 },
      { id: 2, title: 'Review Smart Contracts', completed: true, points: 300 },
      { id: 3, title: 'User Testing', completed: false, points: 200 },
    ],
  },
  
  // Helper functions
  waitForElement: async (element) => {
    await waitFor(element).toBeVisible().withTimeout(5000);
  },
  
  tapButton: async (element) => {
    await element.tap();
  },
  
  inputText: async (element, text) => {
    await element.replaceText(text);
  },
  
  scrollTo: async (element, direction = 'down') => {
    await element.scroll(direction, 200);
  },
};

// Test setup helpers
beforeEach(async () => {
  // Reset device state
  await device.reloadReactNative();
  
  // Clear app data
  await device.clearKeychain();
  
  // Grant permissions
  await device.setInstallInstallOnly(false);
});

// Cleanup after tests
afterAll(async () => {
  // Clean up any test data
  await device.terminateApp();
});

// Network mocking for mobile tests
global.mockNetwork = {
  mockApiResponse: (url, response) => {
    // Mock network responses for testing
    console.log(`Mocking API response for ${url}:`, response);
  },
  
  enableOfflineMode: () => {
    // Simulate offline mode
    console.log('Enabling offline mode');
  },
  
  enableNetworkDelay: (delay = 1000) => {
    // Simulate network delay
    console.log(`Adding ${delay}ms network delay`);
  },
};