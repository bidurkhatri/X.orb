import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/playwright',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'e2e/playwright-report' }],
    ['json', { outputFile: 'e2e/playwright-results/results.json' }],
    ['junit', { outputFile: 'e2e/playwright-results/junit.xml' }],
  ],
  
  use: {
    // Base URL to use in actions like await page.goto('/')
    baseURL: 'http://localhost:3000',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Record video on failure
    video: 'retain-on-failure',
  },
  
  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    // Mobile testing
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    
    // Microsoft Edge
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    
    // iPad
    {
      name: 'iPad Pro',
      use: { ...devices['iPad Pro'] },
    },
  ],
  
  // Run local dev server before starting the tests
  webServer: {
    command: 'cd ../sylos-blockchain-os && npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});

export const testConfig = {
  // Test settings
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  
  // Test data
  testData: {
    user: {
      email: 'test@example.com',
      password: 'testpassword123',
      name: 'Test User',
    },
    wallet: {
      address: '0x1234567890123456789012345678901234567890',
      privateKey: '0xabcdef123456789abcdef123456789abcdef123456789abcdef123456789abcdef',
    },
    tokens: {
      SYLOS: '0x1234567890abcdef1234567890abcdef12345678',
      wSYLOS: '0xabcdef1234567890abcdef1234567890abcdef12',
    },
  },
  
  // Mobile device configurations
  mobileDevices: ['iPhone 12', 'Pixel 5', 'iPad Pro'],
  
  // Accessibility testing
  accessibility: {
    WCAG_LEVEL: 'AA',
    INCLUDE_INCOMPLETE: true,
  },
  
  // Performance testing
  performance: {
    LCP_THRESHOLD: 2500,
    FID_THRESHOLD: 100,
    CLS_THRESHOLD: 0.1,
  },
};