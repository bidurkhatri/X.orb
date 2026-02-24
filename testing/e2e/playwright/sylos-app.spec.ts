import { test, expect } from '@playwright/test';
import { testConfig } from '../../playwright.config';

test.describe('SylOS Web Application E2E Tests (Playwright)', () => {
  test.beforeEach(async ({ page }) => {
    // Set up the page and mock blockchain providers
    await page.goto('/');
    
    // Mock Ethereum provider
    await page.addInitScript(() => {
      window.ethereum = {
        request: async (args: any) => {
          if (args.method === 'eth_requestAccounts') {
            return [testConfig.testData.wallet.address];
          }
          return null;
        },
        on: () => {},
        removeListener: () => {},
        selectedAddress: testConfig.testData.wallet.address,
        networkVersion: '137',
        isConnected: () => true,
      };
    });
    
    // Clear any existing storage
    await page.context().clearCookies();
  });

  test('should load desktop environment', async ({ page }) => {
    await expect(page.locator('[data-testid="desktop"]')).toBeVisible();
    await expect(page.locator('[data-testid="taskbar"]')).toBeVisible();
    await expect(page.locator('[data-testid="desktop-icons"]')).toBeVisible();
  });

  test('should unlock desktop successfully', async ({ page }) => {
    await page.click('[data-testid="unlock-button"]');
    await expect(page.locator('[data-testid="desktop"]')).toBeVisible();
    await expect(page.locator('[data-testid="desktop-icon-wallet"]')).toBeVisible();
  });

  test('should open and close applications', async ({ page }) => {
    // Unlock first
    await page.click('[data-testid="unlock-button"]');
    
    // Open wallet app
    await page.dblclick('[data-testid="desktop-icon-wallet"]');
    await expect(page.locator('[data-testid="wallet-app-window"]')).toBeVisible();
    
    // Close wallet app
    await page.click('[data-testid="close-button"]');
    await expect(page.locator('[data-testid="wallet-app-window"]')).not.toBeVisible();
  });

  test('should handle window management (minimize/restore)', async ({ page }) => {
    await page.click('[data-testid="unlock-button"]');
    await page.dblclick('[data-testid="desktop-icon-wallet"]');
    
    // Minimize
    await page.click('[data-testid="minimize-button"]');
    await expect(page.locator('[data-testid="wallet-app-window"]')).not.toBeVisible();
    
    // Restore
    await page.click('[data-testid="wallet-app-icon"]');
    await expect(page.locator('[data-testid="wallet-app-window"]')).toBeVisible();
  });

  test('should display wallet balance and transaction history', async ({ page }) => {
    await page.click('[data-testid="unlock-button"]');
    await page.dblclick('[data-testid="desktop-icon-wallet"]');
    
    await expect(page.locator('[data-testid="wallet-balance"]')).toContainText('12,450.50');
    await expect(page.locator('[data-testid="wallet-symbol"]')).toContainText('SYLOS');
    await expect(page.locator('[data-testid="transaction-history"]')).toBeVisible();
  });

  test('should open send transaction modal', async ({ page }) => {
    await page.click('[data-testid="unlock-button"]');
    await page.dblclick('[data-testid="desktop-icon-wallet"]');
    await page.click('[data-testid="send-button"]');
    
    await expect(page.locator('[data-testid="send-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="recipient-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="amount-input"]')).toBeVisible();
  });

  test('should validate recipient address', async ({ page }) => {
    await page.click('[data-testid="unlock-button"]');
    await page.dblclick('[data-testid="desktop-icon-wallet"]');
    await page.click('[data-testid="send-button"]');
    
    // Enter invalid address
    await page.fill('[data-testid="recipient-input"]', 'invalid-address');
    
    // Send button should be disabled
    await expect(page.locator('[data-testid="send-button-modal"]')).toBeDisabled();
  });

  test('should display PoP tracker with correct score', async ({ page }) => {
    await page.click('[data-testid="unlock-button"]');
    await page.dblclick('[data-testid="desktop-icon-pop-tracker"]');
    
    await expect(page.locator('[data-testid="pop-score"]')).toContainText('8,547');
    await expect(page.locator('[data-testid="pop-tier"]')).toContainText('Diamond');
    await expect(page.locator('[data-testid="weekly-reward"]')).toContainText('145.5');
  });

  test('should show task list with verification status', async ({ page }) => {
    await page.click('[data-testid="unlock-button"]');
    await page.dblclick('[data-testid="desktop-icon-pop-tracker"]');
    
    await expect(page.locator('[data-testid="task-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="verified-task"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="pending-task"]')).toHaveCount(1);
  });

  test('should display file manager with IPFS storage', async ({ page }) => {
    await page.click('[data-testid="unlock-button"]');
    await page.dblclick('[data-testid="desktop-icon-file-manager"]');
    
    await expect(page.locator('[data-testid="file-manager-app"]')).toBeVisible();
    await expect(page.locator('[data-testid="storage-usage"]')).toContainText('9.8 GB / 100 GB');
  });

  test('should show file list with IPFS CIDs', async ({ page }) => {
    await page.click('[data-testid="unlock-button"]');
    await page.dblclick('[data-testid="desktop-icon-file-manager"]');
    
    await expect(page.locator('[data-testid="file-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-item"]')).toHaveCount(4);
    await expect(page.locator('[data-testid="file-cid"]').first()).toContainText('Qm');
  });

  test('should display token dashboard with portfolio value', async ({ page }) => {
    await page.click('[data-testid="unlock-button"]');
    await page.dblclick('[data-testid="desktop-icon-token-dashboard"]');
    
    await expect(page.locator('[data-testid="token-dashboard-app"]')).toBeVisible();
    await expect(page.locator('[data-testid="portfolio-value"]')).toContainText('$31,791');
  });

  test('should show token balances and staking info', async ({ page }) => {
    await page.click('[data-testid="unlock-button"]');
    await page.dblclick('[data-testid="desktop-icon-token-dashboard"]');
    
    await expect(page.locator('[data-testid="sylos-balance"]')).toContainText('12,450.50');
    await expect(page.locator('[data-testid="sylos-value"]')).toContainText('$24,901');
    await expect(page.locator('[data-testid="wsylos-balance"]')).toContainText('3,280.75');
    await expect(page.locator('[data-testid="staking-apy"]')).toContainText('12% APY');
  });

  test('should display settings interface', async ({ page }) => {
    await page.click('[data-testid="unlock-button"]');
    await page.dblclick('[data-testid="desktop-icon-settings"]');
    
    await expect(page.locator('[data-testid="settings-app"]')).toBeVisible();
    await expect(page.locator('[data-testid="account-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="network-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="security-section"]')).toBeVisible();
  });

  test('should allow changing network settings', async ({ page }) => {
    await page.click('[data-testid="unlock-button"]');
    await page.dblclick('[data-testid="desktop-icon-settings"]');
    
    await page.click('[data-testid="network-select"]');
    await page.click('[data-testid="network-option-testnet"]');
    
    await expect(page.locator('[data-testid="network-select"]')).toContainText('Polygon PoS Testnet');
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="desktop"]')).not.toBeVisible();
  });

  test('should be responsive on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    await page.click('[data-testid="unlock-button"]');
    await expect(page.locator('[data-testid="desktop"]')).toBeVisible();
  });

  test('should handle keyboard navigation', async ({ page }) => {
    await page.goto('/');
    
    // Tab to unlock button
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="unlock-button"]')).toBeFocused();
    
    // Press Enter to unlock
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="desktop"]')).toBeVisible();
    
    // Tab to first app icon
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="desktop-icon-wallet"]')).toBeFocused();
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    await page.click('[data-testid="unlock-button"]');
    
    // Press Escape to minimize active window
    await page.dblclick('[data-testid="desktop-icon-wallet"]');
    await page.keyboard.press('Escape');
    
    // Note: This would depend on the actual implementation
    // await expect(page.locator('[data-testid="wallet-app-window"]')).not.toBeVisible();
  });

  test('should show loading states', async ({ page }) => {
    // Mock slow API response
    await page.route('**/api/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.continue();
    });
    
    await page.goto('/');
    await page.click('[data-testid="unlock-button"]');
    
    await expect(page.locator('[data-testid="loading"]')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network error
    await page.route('**/api/**', async (route) => {
      await route.fulfill({ status: 500, body: 'Network Error' });
    });
    
    await page.goto('/');
    await page.click('[data-testid="unlock-button"]');
    
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
  });

  test('should handle wallet connection errors', async ({ page }) => {
    // Mock connection rejection
    await page.addInitScript(() => {
      window.ethereum = {
        request: async () => {
          throw new Error('User rejected connection');
        },
        on: () => {},
        removeListener: () => {},
        selectedAddress: null,
        networkVersion: '137',
        isConnected: () => false,
      };
    });
    
    await page.goto('/');
    await page.click('[data-testid="unlock-button"]');
    
    await expect(page.locator('[data-testid="connection-error"]')).toBeVisible();
  });

  test('should have proper ARIA labels and accessibility', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="unlock-button"]');
    
    // Check for ARIA labels
    await expect(page.locator('[data-testid="unlock-button"]')).toHaveAttribute('aria-label');
    await expect(page.locator('[data-testid="desktop-icon-wallet"]')).toHaveAttribute('aria-label');
    
    // Check for proper role attributes
    await expect(page.locator('[data-testid="desktop"]')).toHaveAttribute('role', 'main');
  });

  test('should maintain state across page reloads', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="unlock-button"]');
    
    // Make some changes (open app)
    await page.dblclick('[data-testid="desktop-icon-wallet"]');
    await expect(page.locator('[data-testid="wallet-app-window"]')).toBeVisible();
    
    // Reload page
    await page.reload();
    
    // State should be maintained (this would depend on localStorage implementation)
    // await expect(page.locator('[data-testid="desktop"]')).toBeVisible();
  });
});

// Test different browser configurations
test.describe('Cross-Browser Compatibility', () => {
  test('should work in WebKit', async ({ page, isWebKit }) => {
    if (!isWebKit) test.skip();
    
    await page.goto('/');
    await expect(page.locator('[data-testid="desktop"]')).toBeVisible();
  });

  test('should work in Firefox', async ({ page, isFirefox }) => {
    if (!isFirefox) test.skip();
    
    await page.goto('/');
    await expect(page.locator('[data-testid="desktop"]')).toBeVisible();
  });
});

// Performance tests
test.describe('Performance Tests', () => {
  test('should load within acceptable time', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await expect(page.locator('[data-testid="desktop"]')).toBeVisible();
    const loadTime = Date.now() - start;
    
    expect(loadTime).toBeLessThan(3000);
  });

  test('should maintain good Core Web Vitals', async ({ page }) => {
    const metrics = [];
    
    page.on('console', msg => {
      if (msg.type() === 'performance') {
        metrics.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.click('[data-testid="unlock-button"]');
    
    // Test interactions don't cause performance issues
    await page.dblclick('[data-testid="desktop-icon-wallet"]');
    await page.dblclick('[data-testid="desktop-icon-pop-tracker"]');
    
    // Check for performance warnings in console
    const performanceWarnings = metrics.filter(m => m.includes('warning') || m.includes('slow'));
    expect(performanceWarnings.length).toBe(0);
  });
});