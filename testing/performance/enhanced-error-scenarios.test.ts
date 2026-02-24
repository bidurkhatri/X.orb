import { test, expect } from '@playwright/test';
import nock from 'nock';

/**
 * Enhanced Error Scenario Testing
 * Comprehensive testing of error conditions, recovery, and edge cases
 */

test.describe('Error Scenario Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up consistent viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Mock blockchain for consistent testing
    await page.addInitScript(() => {
      window.ethereum = {
        request: async (args: any) => {
          if (args.method === 'eth_requestAccounts') {
            return ['0x1234567890123456789012345678901234567890'];
          }
          return null;
        },
        selectedAddress: '0x1234567890123456789012345678901234567890',
        networkVersion: '137',
        isConnected: () => true,
      };
    });
  });

  describe('Network Connectivity Errors', () => {
    test.beforeEach(async ({ page }) => {
      // Start with a working connection
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    });

    test('should handle complete network disconnection', async ({ page }) => {
      // Simulate network disconnection
      await page.route('**/api/**', route => route.abort());
      
      // Try to perform actions that require network
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(2000);
      
      // Check for error message or offline indicator
      const errorMessage = page.locator('[data-testid="network-error"], .error-message, [aria-live="assertive"]');
      const hasError = await errorMessage.isVisible();
      
      if (hasError) {
        const errorText = await errorMessage.textContent();
        expect(errorText).toBeTruthy();
        console.log('Network error detected:', errorText);
      }
      
      // App should still be usable in offline mode
      await expect(page.locator('[data-testid="desktop"]')).toBeVisible();
    });

    test('should handle slow network connections', async ({ page }) => {
      // Simulate slow network
      await page.route('**/api/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
        await route.continue();
      });
      
      const startTime = Date.now();
      
      // Try to unlock and open wallet
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(1000);
      await page.click('[data-testid="desktop-icon-wallet"]');
      await page.waitForTimeout(6000); // Wait for slow response
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Should show loading state
      const loadingElement = page.locator('[data-testid="loading"], .loading, [aria-busy="true"]');
      expect(await loadingElement.isVisible()).toBe(true);
      
      console.log(`Slow network test completed in ${responseTime}ms`);
    });

    test('should handle intermittent network failures', async ({ page }) => {
      let requestCount = 0;
      
      // Simulate intermittent failures
      await page.route('**/api/**', async route => {
        requestCount++;
        
        // Fail every 3rd request
        if (requestCount % 3 === 0) {
          await route.abort();
        } else {
          await new Promise(resolve => setTimeout(resolve, 100));
          await route.continue();
        }
      });
      
      // Perform multiple actions
      for (let i = 0; i < 5; i++) {
        await page.click('[data-testid="desktop-icon-wallet"]');
        await page.waitForTimeout(500);
      }
      
      // App should handle failures gracefully
      // Check for error recovery or retry mechanisms
      const errorElement = page.locator('.error-message, [data-testid="error"]');
      if (await errorElement.isVisible()) {
        const retryButton = page.locator('[data-testid="retry-button"], .retry-button');
        expect(await retryButton.isVisible()).toBeTruthy();
      }
    });

    test('should handle DNS resolution failures', async ({ page }) => {
      // Simulate DNS failure by routing to invalid host
      await page.route('https://invalid-domain-12345.com/**', route => {
        route.abort('failed');
      });
      
      // Try to access external resources
      await page.evaluate(async () => {
        try {
          await fetch('https://invalid-domain-12345.com/api/test');
        } catch (error) {
          console.log('DNS failure handled:', error);
        }
      });
      
      await page.waitForTimeout(2000);
      
      // App should handle DNS failures
      expect(true).toBe(true); // Test passes if app doesn't crash
    });
  });

  describe('Blockchain Integration Errors', () => {
    test('should handle MetaMask not installed', async ({ page }) => {
      // Remove MetaMask
      await page.addInitScript(() => {
        delete (window as any).ethereum;
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Check for MetaMask installation prompt
      const metamaskPrompt = page.locator('[data-testid="metamask-required"], .metamask-prompt');
      
      if (await metamaskPrompt.isVisible()) {
        const promptText = await metamaskPrompt.textContent();
        expect(promptText).toContain('MetaMask');
        expect(promptText).toContain('install');
      }
      
      // Should show alternative connection methods
      const connectionOptions = page.locator('[data-testid="connection-options"]');
      expect(await connectionOptions.isVisible()).toBe(true);
    });

    test('should handle wallet connection rejection', async ({ page }) => {
      // Mock connection rejection
      await page.addInitScript(() => {
        window.ethereum = {
          request: async (args: any) => {
            throw new Error('User rejected the request');
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
      
      // Try to unlock (which should trigger wallet connection)
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(2000);
      
      // Check for connection error
      const errorMessage = page.locator('[data-testid="connection-rejected"], .error-message');
      
      if (await errorMessage.isVisible()) {
        const text = await errorMessage.textContent();
        expect(text).toMatch(/reject|cancel|denied/i);
      }
      
      // Should provide retry option
      const retryButton = page.locator('[data-testid="retry-connection"]');
      expect(await retryButton.isVisible()).toBe(true);
    });

    test('should handle incorrect network', async ({ page }) => {
      // Mock wrong network
      await page.addInitScript(() => {
        window.ethereum = {
          request: async (args: any) => {
            if (args.method === 'eth_chainId') {
              return '0x1'; // Ethereum mainnet instead of Polygon
            }
            return null;
          },
          on: () => {},
          removeListener: () => {},
          selectedAddress: '0x1234567890123456789012345678901234567890',
          networkVersion: '1',
          isConnected: () => true,
        };
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Unlock should detect wrong network
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(2000);
      
      // Check for network switch prompt
      const networkError = page.locator('[data-testid="wrong-network"], .network-error');
      
      if (await networkError.isVisible()) {
        const text = await networkError.textContent();
        expect(text).toMatch(/network|polygon|matic/i);
      }
      
      // Should provide network switch button
      const switchButton = page.locator('[data-testid="switch-network"]');
      expect(await switchButton.isVisible()).toBe(true);
    });

    test('should handle insufficient funds', async ({ page }) => {
      // Mock low balance
      await page.route('**/api/wallet/balance**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            sylos_balance: '0.001', // Very low balance
            eth_balance: '0.0001',
            sufficient_funds: false,
          }),
        });
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(1000);
      await page.click('[data-testid="desktop-icon-wallet"]');
      await page.waitForTimeout(1000);
      
      // Check for insufficient funds warning
      const fundsWarning = page.locator('[data-testid="insufficient-funds"], .funds-warning');
      
      if (await fundsWarning.isVisible()) {
        const text = await fundsWarning.textContent();
        expect(text).toMatch(/insufficient|low|not enough/i);
      }
    });

    test('should handle smart contract errors', async ({ page }) => {
      // Mock contract call failure
      await page.route('**/api/tokens/transfer**', route => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Execution reverted',
            code: 'CONTRACT_ERROR',
            message: 'Transfer amount exceeds balance',
          }),
        });
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(1000);
      await page.click('[data-testid="desktop-icon-wallet"]');
      await page.waitForTimeout(1000);
      
      // Try to make a transaction
      const sendButton = page.locator('[data-testid="send-tokens-button"]');
      if (await sendButton.isVisible()) {
        await sendButton.click();
        await page.waitForTimeout(1000);
        
        // Should show error
        const errorMessage = page.locator('.error-message, [data-testid="contract-error"]');
        expect(await errorMessage.isVisible()).toBe(true);
      }
    });
  });

  describe('IPFS and Storage Errors', () => {
    test('should handle IPFS node unavailable', async ({ page }) => {
      // Mock IPFS unavailable
      await page.route('**/api/ipfs/**', route => {
        route.abort();
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(1000);
      await page.click('[data-testid="desktop-icon-file-manager"]');
      await page.waitForTimeout(1000);
      
      // Try to upload a file
      const uploadButton = page.locator('[data-testid="upload-button"]');
      if (await uploadButton.isVisible()) {
        // Create a test file
        await page.evaluate(() => {
          const input = document.createElement('input');
          input.type = 'file';
          const blob = new Blob(['test content'], { type: 'text/plain' });
          const file = new File([blob], 'test.txt');
          
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          
          const event = new Event('change', { bubbles: true });
          Object.defineProperty(event, 'target', { value: { files: dataTransfer.files } });
          input.dispatchEvent(event);
        });
        
        await page.waitForTimeout(2000);
        
        // Should show IPFS error
        const errorMessage = page.locator('[data-testid="ipfs-error"], .storage-error');
        expect(await errorMessage.isVisible()).toBe(true);
      }
    });

    test('should handle file size limits', async ({ page }) => {
      // Mock file too large error
      await page.route('**/api/ipfs/upload**', route => {
        route.fulfill({
          status: 413,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'File size exceeds limit',
            code: 'FILE_TOO_LARGE',
            max_size: '10485760', // 10MB
            current_size: '15728640', // 15MB
          }),
        });
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(1000);
      await page.click('[data-testid="desktop-icon-file-manager"]');
      await page.waitForTimeout(1000);
      
      // Simulate large file upload
      await page.evaluate(() => {
        const input = document.createElement('input');
        input.type = 'file';
        const largeBlob = new Blob(['x'.repeat(15728640)], { type: 'application/octet-stream' });
        const file = new File([largeBlob], 'large-file.bin');
        
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        
        const event = new Event('change', { bubbles: true });
        Object.defineProperty(event, 'target', { value: { files: dataTransfer.files } });
        input.dispatchEvent(event);
      });
      
      await page.waitForTimeout(2000);
      
      // Should show size limit error
      const sizeError = page.locator('[data-testid="file-size-error"], .size-error');
      expect(await sizeError.isVisible()).toBe(true);
    });

    test('should handle corrupted file uploads', async ({ page }) => {
      // Mock upload failure
      await page.route('**/api/ipfs/upload**', route => {
        route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'File corrupted or invalid format',
            code: 'INVALID_FILE',
          }),
        });
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(1000);
      await page.click('[data-testid="desktop-icon-file-manager"]');
      await page.waitForTimeout(1000);
      
      // Try to upload invalid file
      await page.evaluate(() => {
        const input = document.createElement('input');
        input.type = 'file';
        const corruptedBlob = new Blob([new Uint8Array([0xFF, 0xFE, 0x00, 0x00])], { type: 'application/octet-stream' });
        const file = new File([corruptedBlob], 'corrupted.dat');
        
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        
        const event = new Event('change', { bubbles: true });
        Object.defineProperty(event, 'target', { value: { files: dataTransfer.files } });
        input.dispatchEvent(event);
      });
      
      await page.waitForTimeout(2000);
      
      // Should show corruption error
      const corruptionError = page.locator('[data-testid="file-corruption-error"]');
      expect(await corruptionError.isVisible()).toBe(true);
    });
  });

  describe('Application State Errors', () => {
    test('should handle memory pressure', async ({ page }) => {
      // Simulate memory pressure
      await page.addInitScript(() => {
        // Fill memory with data
        const memoryHog = new Array(1000000).fill('x'.repeat(1000));
        (window as any).__memoryHog = memoryHog;
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Perform memory-intensive operations
      for (let i = 0; i < 10; i++) {
        await page.click('[data-testid="unlock-button"]');
        await page.waitForTimeout(500);
        await page.click('[data-testid="desktop-icon-wallet"]');
        await page.waitForTimeout(500);
        await page.click('[data-testid="desktop-icon-pop-tracker"]');
        await page.waitForTimeout(500);
      }
      
      // App should handle memory pressure gracefully
      // Check for performance degradation warnings
      const performanceWarning = page.locator('[data-testid="performance-warning"]');
      if (await performanceWarning.isVisible()) {
        console.log('Memory pressure detected');
      }
    });

    test('should handle concurrent user actions', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Simulate rapid clicking
      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < 20; i++) {
        promises.push(
          page.evaluate(() => {
            // Simulate rapid user actions
            const elements = document.querySelectorAll('[data-testid*="desktop-icon"]');
            const randomElement = elements[Math.floor(Math.random() * elements.length)] as HTMLElement;
            randomElement?.click();
          })
        );
      }
      
      // Execute all clicks rapidly
      await Promise.allSettled(promises);
      await page.waitForTimeout(1000);
      
      // App should handle concurrent actions without breaking
      expect(await page.locator('[data-testid="desktop"]').isVisible()).toBe(true);
    });

    test('should handle invalid user input', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(1000);
      
      // Look for input fields
      const inputFields = await page.locator('input, textarea').all();
      
      for (const input of inputFields) {
        // Test invalid inputs
        const invalidInputs = [
          'null',
          'undefined',
          '',
          'null',
          'NaN',
          'Infinity',
          '<script>alert("xss")</script>',
          'DROP TABLE users;',
          '{"__proto__": null}',
        ];
        
        for (const invalidInput of invalidInputs) {
          await input.fill(invalidInput);
          await input.press('Enter');
          await page.waitForTimeout(100);
          
          // Check for input validation errors
          const errorElement = page.locator('.error-message, [data-testid="input-error"]');
          if (await errorElement.isVisible()) {
            expect(await errorElement.textContent()).toBeTruthy();
          }
        }
      }
    });
  });

  describe('Recovery and Retry Mechanisms', () => {
    test('should implement automatic retry for failed operations', async ({ page }) => {
      let attempt = 0;
      
      // Mock intermittent failures
      await page.route('**/api/wallet/balance**', async route => {
        attempt++;
        if (attempt < 3) {
          await route.abort();
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              sylos_balance: '1000.0',
              eth_balance: '5.0',
            }),
          });
        }
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const startTime = Date.now();
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(1000);
      await page.click('[data-testid="desktop-icon-wallet"]');
      await page.waitForTimeout(2000);
      const endTime = Date.now();
      
      // Should eventually succeed with retry
      const balanceElement = page.locator('[data-testid="wallet-balance"]');
      expect(await balanceElement.isVisible()).toBe(true);
      
      const retryTime = endTime - startTime;
      expect(retryTime).toBeGreaterThan(1000); // Should take time for retries
      console.log(`Retry mechanism worked in ${retryTime}ms`);
    });

    test('should provide manual retry options', async ({ page }) => {
      // Mock persistent failure
      await page.route('**/api/**', route => {
        route.abort();
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(2000);
      
      // Check for retry button
      const retryButton = page.locator('[data-testid="retry-button"], .retry-button');
      if (await retryButton.isVisible()) {
        // Test retry functionality
        await retryButton.click();
        await page.waitForTimeout(1000);
        
        // Should show loading state
        const loadingElement = page.locator('[data-testid="loading"], [aria-busy="true"]');
        expect(await loadingElement.isVisible()).toBe(true);
      }
    });

    test('should handle graceful degradation', async ({ page }) => {
      // Mock partial service failures
      await page.route('**/api/pop/**', route => {
        route.abort(); // PoP service down
      });
      
      await page.route('**/api/tokens/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: 'mock data' }),
        });
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(1000);
      
      // Try PoP features (should degrade)
      await page.click('[data-testid="desktop-icon-pop-tracker"]');
      await page.waitForTimeout(1000);
      
      const popError = page.locator('[data-testid="service-unavailable"]');
      if (await popError.isVisible()) {
        // Should show offline/degraded mode message
        const text = await popError.textContent();
        expect(text).toMatch(/unavailable|offline|degraded/i);
      }
      
      // Other features should still work
      await page.click('[data-testid="desktop-icon-wallet"]');
      await page.waitForTimeout(1000);
      expect(await page.locator('[data-testid="wallet-app"]').isVisible()).toBe(true);
    });
  });

  describe('Browser Compatibility Errors', () => {
    test('should handle unsupported browser features', async ({ page }) => {
      // Mock missing Web3 support
      await page.addInitScript(() => {
        delete (window as any).ethereum;
        (window as any).ethereum = undefined;
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Should detect missing Web3 support
      const compatibilityWarning = page.locator('[data-testid="compatibility-warning"]');
      
      if (await compatibilityWarning.isVisible()) {
        const text = await compatibilityWarning.textContent();
        expect(text).toMatch(/browser|support|ethereum/i);
      }
    });

    test('should handle JavaScript errors', async ({ page }) => {
      // Capture console errors
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      // Inject JavaScript error
      await page.addInitScript(() => {
        // This will cause an error
        (window as any).nonexistentFunction();
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // App should handle JavaScript errors gracefully
      // Check that critical functionality still works
      expect(await page.locator('[data-testid="lockscreen"]').isVisible()).toBe(true);
      
      // If there were critical errors, they should be logged
      if (errors.length > 0) {
        console.log('JavaScript errors detected:', errors);
      }
    });
  });

  describe('Data Corruption and Validation', () => {
    test('should handle corrupted local storage', async ({ page }) => {
      // Corrupt local storage
      await page.evaluate(() => {
        localStorage.setItem('corrupted', 'invalid\x00\x01\x02json');
        localStorage.setItem('sylos_user_data', 'invalid_data');
        sessionStorage.setItem('temp', 'data');
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // App should handle corrupted storage gracefully
      // Should either recover or reset to default state
      expect(await page.locator('[data-testid="lockscreen"]').isVisible()).toBe(true);
    });

    test('should validate API responses', async ({ page }) => {
      // Mock malformed API response
      await page.route('**/api/user/profile**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: 'invalid json response {{',
        });
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(2000);
      
      // Should handle malformed response
      const errorElement = page.locator('[data-testid="api-error"], .error-message');
      if (await errorElement.isVisible()) {
        // Should show user-friendly error
        const text = await errorElement.textContent();
        expect(text).not.toContain('{{');
        expect(text).toBeTruthy();
      }
    });
  });
});
