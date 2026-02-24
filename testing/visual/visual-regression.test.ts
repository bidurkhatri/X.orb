import { test, expect, Page } from '@playwright/test';
import { defineConfig, devices } from '@playwright/test';

/**
 * Visual Regression Testing Configuration
 * Tests for visual changes in UI components and pages
 */

test.describe('Visual Regression Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Set up consistent viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Disable animations for consistent screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
      `
    });

    // Mock blockchain connections for consistent testing
    await page.addInitScript(() => {
      window.ethereum = {
        request: async (args: any) => {
          if (args.method === 'eth_requestAccounts') {
            return ['0x1234567890123456789012345678901234567890'];
          }
          if (args.method === 'eth_chainId') {
            return '0x89'; // Polygon mainnet
          }
          return null;
        },
        on: () => {},
        removeListener: () => {},
        selectedAddress: '0x1234567890123456789012345678901234567890',
        networkVersion: '137',
        isConnected: () => true,
      };
    });
  });

  describe('Desktop Interface', () => {
    test.beforeEach(async () => {
      await page.goto('/');
    });

    test('desktop lock screen - baseline', async () => {
      await page.waitForLoadState('networkidle');
      
      // Take full page screenshot
      await expect(page).toHaveScreenshot('desktop-lockscreen.png', {
        fullPage: true,
        animations: 'disabled',
      });

      // Check specific elements
      await expect(page.locator('[data-testid="lockscreen"]')).toBeVisible();
      await expect(page.locator('[data-testid="unlock-button"]')).toBeVisible();
    });

    test('desktop unlocked - baseline', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Unlock desktop
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(1000); // Wait for unlock animation
      
      await expect(page).toHaveScreenshot('desktop-unlocked.png', {
        fullPage: true,
        animations: 'disabled',
      });

      // Check desktop elements
      await expect(page.locator('[data-testid="desktop"]')).toBeVisible();
      await expect(page.locator('[data-testid="taskbar"]')).toBeVisible();
      await expect(page.locator('[data-testid="desktop-icons"]')).toBeVisible();
    });

    test('desktop with wallet app open', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Unlock and open wallet
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(500);
      await page.click('[data-testid="desktop-icon-wallet"]');
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot('desktop-wallet-open.png', {
        fullPage: true,
        animations: 'disabled',
      });

      // Check wallet app elements
      await expect(page.locator('[data-testid="wallet-app"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-balance"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-address"]')).toBeVisible();
    });

    test('desktop with PoP tracker open', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Unlock and open PoP tracker
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(500);
      await page.click('[data-testid="desktop-icon-pop-tracker"]');
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot('desktop-pop-tracker-open.png', {
        fullPage: true,
        animations: 'disabled',
      });

      // Check PoP tracker elements
      await expect(page.locator('[data-testid="pop-tracker-app"]')).toBeVisible();
      await expect(page.locator('[data-testid="pop-score"]')).toBeVisible();
      await expect(page.locator('[data-testid="pop-tier"]')).toBeVisible();
    });

    test('desktop with file manager open', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Unlock and open file manager
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(500);
      await page.click('[data-testid="desktop-icon-file-manager"]');
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot('desktop-file-manager-open.png', {
        fullPage: true,
        animations: 'disabled',
      });

      // Check file manager elements
      await expect(page.locator('[data-testid="file-manager-app"]')).toBeVisible();
      await expect(page.locator('[data-testid="file-grid"]')).toBeVisible();
      await expect(page.locator('[data-testid="upload-button"]')).toBeVisible();
    });

    test('desktop with token dashboard open', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Unlock and open token dashboard
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(500);
      await page.click('[data-testid="desktop-icon-token-dashboard"]');
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot('desktop-token-dashboard-open.png', {
        fullPage: true,
        animations: 'disabled',
      });

      // Check token dashboard elements
      await expect(page.locator('[data-testid="token-dashboard-app"]')).toBeVisible();
      await expect(page.locator('[data-testid="token-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="portfolio-value"]')).toBeVisible();
    });
  });

  describe('Mobile Interface', () => {
    test.beforeEach(async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/');
    });

    test('mobile lock screen', async () => {
      await page.waitForLoadState('networkidle');
      
      await expect(page).toHaveScreenshot('mobile-lockscreen.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('mobile unlocked', async () => {
      await page.waitForLoadState('networkidle');
      
      // Unlock mobile
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot('mobile-unlocked.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('mobile wallet app', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Unlock and open wallet
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(500);
      await page.click('[data-testid="mobile-wallet-button"]');
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot('mobile-wallet-app.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });
  });

  describe('Different Viewports', () => {
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop-1920x1080' },
      { width: 1366, height: 768, name: 'desktop-1366x768' },
      { width: 1440, height: 900, name: 'desktop-1440x900' },
      { width: 768, height: 1024, name: 'tablet-768x1024' },
      { width: 1024, height: 768, name: 'tablet-1024x768' },
      { width: 375, height: 812, name: 'mobile-375x812' },
      { width: 414, height: 896, name: 'mobile-414x896' },
      { width: 360, height: 640, name: 'mobile-360x640' },
    ];

    viewports.forEach(({ width, height, name }) => {
      test(`desktop unlocked at ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // Unlock
        await page.click('[data-testid="unlock-button"]');
        await page.waitForTimeout(1000);
        
        await expect(page).toHaveScreenshot(`desktop-unlocked-${name}.png`, {
          fullPage: true,
          animations: 'disabled',
        });
      });
    });
  });

  describe('Component Visual Tests', () => {
    test('wallet card component', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(500);
      
      // Get wallet card element
      const walletCard = page.locator('[data-testid="wallet-card"]');
      await expect(walletCard).toBeVisible();
      
      await expect(walletCard).toHaveScreenshot('wallet-card-component.png');
    });

    test('pop score display component', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(500);
      
      // Get PoP score display
      const popScore = page.locator('[data-testid="pop-score-display"]');
      await expect(popScore).toBeVisible();
      
      await expect(popScore).toHaveScreenshot('pop-score-component.png');
    });

    test('token list component', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(500);
      await page.click('[data-testid="desktop-icon-token-dashboard"]');
      await page.waitForTimeout(1000);
      
      // Get token list element
      const tokenList = page.locator('[data-testid="token-list"]');
      await expect(tokenList).toBeVisible();
      
      await expect(tokenList).toHaveScreenshot('token-list-component.png');
    });

    test('taskbar component', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(500);
      
      // Get taskbar element
      const taskbar = page.locator('[data-testid="taskbar"]');
      await expect(taskbar).toBeVisible();
      
      await expect(taskbar).toHaveScreenshot('taskbar-component.png');
    });

    test('desktop icons component', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(500);
      
      // Get desktop icons
      const desktopIcons = page.locator('[data-testid="desktop-icons"]');
      await expect(desktopIcons).toBeVisible();
      
      await expect(desktopIcons).toHaveScreenshot('desktop-icons-component.png');
    });
  });

  describe('Error States', () => {
    test('network error state', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Simulate network error by blocking requests
      await page.route('**/api/**', route => route.abort());
      
      // Try to load a page that requires API
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(2000);
      
      await expect(page).toHaveScreenshot('error-network-state.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('wallet not connected state', async () => {
      // Mock wallet not connected
      await page.addInitScript(() => {
        window.ethereum = {
          request: async (args: any) => {
            throw new Error('User rejected request');
          },
          on: () => {},
          removeListener: () => {},
          selectedAddress: null,
          networkVersion: '137',
          isConnected: () => false,
        };
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await expect(page).toHaveScreenshot('error-wallet-not-connected.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });
  });

  describe('Loading States', () => {
    test('desktop loading state', async () => {
      // Mock slow API responses
      await page.route('**/api/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 3000));
        await route.continue();
      });
      
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      
      // Capture loading state
      await expect(page).toHaveScreenshot('loading-desktop.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('wallet loading state', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(500);
      
      // Mock slow wallet data loading
      await page.route('**/api/wallet/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.continue();
      });
      
      await page.click('[data-testid="desktop-icon-wallet"]');
      await page.waitForLoadState('domcontentloaded');
      
      await expect(page).toHaveScreenshot('loading-wallet.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });
  });

  describe('Dark/Light Theme', () => {
    test('dark theme - desktop unlocked', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Set dark theme
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
      });
      
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot('desktop-unlocked-dark-theme.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('light theme - desktop unlocked', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Set light theme
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'light');
      });
      
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot('desktop-unlocked-light-theme.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });
  });
});

/**
 * Playwright Visual Testing Configuration
 */
export default defineConfig({
  testDir: './visual-tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
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
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run start:test',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
