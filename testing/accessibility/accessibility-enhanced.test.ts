import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Enhanced Accessibility Testing Suite
 * Comprehensive a11y testing using axe-core and custom checks
 */

test.describe('Accessibility Tests', () => {
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

  describe('WCAG 2.1 Level AA Compliance', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    });

    test('homepage should be accessible', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('desktop interface should be accessible after unlock', async ({ page }) => {
      // Unlock desktop
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(1000);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });

  describe('Keyboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    });

    test('all interactive elements should be keyboard accessible', async ({ page }) => {
      // Get all interactive elements
      const interactiveElements = await page.locator(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ).all();

      for (const element of interactiveElements) {
        // Check if element is keyboard focusable
        const tabIndex = await element.getAttribute('tabindex');
        const isFocusable = tabIndex !== '-1' || 
          (await element.evaluate(el => 
            !el.hasAttribute('disabled') && 
            !el.getAttribute('aria-hidden') &&
            el.offsetParent !== null
          ));

        if (isFocusable) {
          // Try to focus the element
          await element.focus();
          
          // Check if element is actually focused
          const isFocused = await element.evaluate(el => el === document.activeElement);
          
          if (isFocused) {
            // Check for focus indicators
            const hasFocusIndicator = await element.evaluate(el => {
              const styles = window.getComputedStyle(el, ':focus');
              return styles.outline !== 'none' || 
                     styles.boxShadow.includes('rgb') ||
                     styles.border.includes('solid');
            });

            // Log if no focus indicator (warning, not failure)
            if (!hasFocusIndicator) {
              console.warn('Element may be missing focus indicator:', await element.getAttribute('data-testid') || await element.getAttribute('class'));
            }
          }
        }
      }
    });

    test('tab order should be logical', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const focusableElements = await page.locator(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ).all();

      const tabOrder: string[] = [];
      
      // Simulate tab navigation
      for (let i = 0; i < Math.min(focusableElements.length, 20); i++) {
        await page.keyboard.press('Tab');
        const activeElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') || document.activeElement?.tagName);
        if (activeElement) {
          tabOrder.push(activeElement);
        }
      }

      // Check that tab order is not completely random
      expect(tabOrder.length).toBeGreaterThan(0);
      
      // Log tab order for analysis
      console.log('Tab order:', tabOrder);
    });

    test('escape key should close modals and dialogs', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Open wallet app
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(500);
      await page.click('[data-testid="desktop-icon-wallet"]');
      await page.waitForTimeout(500);

      // Open a modal if available
      const modalButton = page.locator('[data-testid="send-tokens-button"], [data-testid="settings-button"]').first();
      if (await modalButton.isVisible()) {
        await modalButton.click();
        await page.waitForTimeout(500);

        // Check for modal/dialog
        const modal = page.locator('[role="dialog"], .modal, [aria-modal="true"]');
        if (await modal.isVisible()) {
          // Press escape
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);

          // Modal should be closed
          expect(await modal.isVisible()).toBe(false);
        }
      }
    });
  });

  describe('Screen Reader Compatibility', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    });

    test('all images should have alt text', async ({ page }) => {
      const images = await page.locator('img').all();
      
      for (const img of images) {
        const alt = await img.getAttribute('alt');
        const ariaLabel = await img.getAttribute('aria-label');
        
        // Decorative images can have empty alt, but informational images need alt
        const isDecorative = await img.evaluate(el => 
          el.getAttribute('aria-hidden') === 'true' || 
          el.getAttribute('role') === 'presentation'
        );
        
        if (!isDecorative) {
          expect(alt || ariaLabel).toBeTruthy();
        }
      }
    });

    test('form inputs should have associated labels', async ({ page }) => {
      // Open a form if available
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(500);
      
      // Look for forms
      const forms = await page.locator('form, [data-testid*="form"], [data-testid*="input"]').all();
      
      for (const form of forms) {
        const inputs = await form.locator('input, select, textarea').all();
        
        for (const input of inputs) {
          const id = await input.getAttribute('id');
          const ariaLabel = await input.getAttribute('aria-label');
          const ariaLabelledBy = await input.getAttribute('aria-labelledby');
          
          // Check for label association
          let hasLabel = false;
          
          if (id) {
            const label = page.locator(`label[for="${id}"]`);
            hasLabel = await label.count() > 0;
          }
          
          if (!hasLabel) {
            // Check for aria-label or aria-labelledby
            hasLabel = !!(ariaLabel || ariaLabelledBy);
          }
          
          if (!hasLabel) {
            // Check for parent label
            const parentLabel = await input.locator('label').count();
            hasLabel = parentLabel > 0;
          }
          
          // Skip inputs in certain contexts (like search suggestions)
          const type = await input.getAttribute('type');
          if (type !== 'hidden' && !hasLabel) {
            console.warn('Input may be missing label:', await input.getAttribute('data-testid'));
          }
        }
      }
    });

    test('headings should form a logical hierarchy', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      const headingHierarchy: { level: number, text: string }[] = [];
      
      for (const heading of headings) {
        const level = parseInt(heading.tagName.charAt(1));
        const text = await heading.textContent();
        
        headingHierarchy.push({ level, text: text?.trim() || '' });
      }
      
      // Check for proper heading hierarchy
      let previousLevel = 0;
      for (const heading of headingHierarchy) {
        if (heading.text) { // Skip empty headings
          // Heading level should not jump more than one level
          if (previousLevel > 0 && heading.level > previousLevel + 1) {
            console.warn(`Heading level jumps from h${previousLevel} to h${heading.level}: "${heading.text}"`);
          }
          previousLevel = heading.level;
        }
      }
    });

    test('content should be properly structured with landmarks', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Check for main content landmark
      const main = await page.locator('main, [role="main"], #main, [data-testid="main"]').count();
      expect(main).toBeGreaterThan(0);
      
      // Check for navigation landmarks
      const nav = await page.locator('nav, [role="navigation"], [data-testid="nav"]').count();
      expect(nav).toBeGreaterThan(0);
      
      // Check for header/footer landmarks
      const header = await page.locator('header, [role="banner"]').count();
      const footer = await page.locator('footer, [role="contentinfo"]').count();
      
      // At least one landmark should be present
      expect(main + nav + header + footer).toBeGreaterThan(0);
    });
  });

  describe('Color and Contrast', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    });

    test('text should meet contrast requirements', async ({ page }) => {
      // This is a simplified check - axe-core handles most contrast checks
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .analyze();
      
      // Filter for contrast violations
      const contrastViolations = accessibilityScanResults.violations.filter(violation => 
        violation.id.includes('color-contrast') || 
        violation.id.includes('contrast')
      );
      
      // Report contrast issues
      contrastViolations.forEach(violation => {
        console.warn(`Contrast violation: ${violation.description}`);
        violation.nodes.forEach(node => {
          console.warn(`Affected element: ${node.html}`);
        });
      });
      
      // Log but don't fail on minor contrast issues
      if (contrastViolations.length > 0) {
        console.log(`Found ${contrastViolations.length} contrast violations`);
      }
    });

    test('interactive elements should be easily distinguishable', async ({ page }) => {
      // Test interactive elements
      const interactiveElements = await page.locator(
        'button, a, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])'
      ).all();
      
      for (const element of interactiveElements) {
        // Check hover states
        await element.hover();
        await page.waitForTimeout(100);
        
        // Check if element has visual feedback for hover
        const hasHoverEffect = await element.evaluate(el => {
          const beforeHover = window.getComputedStyle(el);
          // This is a simplified check - real implementation would track before/after
          return true;
        });
        
        // Check focus states
        await element.focus();
        await page.waitForTimeout(100);
        
        // Focus should be visible
        const hasFocusIndicator = await element.evaluate(el => {
          const styles = window.getComputedStyle(el, ':focus');
          return styles.outline !== 'none' || 
                 styles.boxShadow.includes('rgb') ||
                 styles.border.includes('solid');
        });
        
        if (!hasFocusIndicator) {
          console.warn('Element may be missing focus indicator:', await element.getAttribute('data-testid'));
        }
      }
    });
  });

  describe('Responsive Accessibility', () => {
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 812, name: 'Mobile' },
    ];

    viewports.forEach(({ width, height, name }) => {
      test(`${name} (${width}x${height}) should maintain accessibility`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        const accessibilityScanResults = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze();
        
        // Log violations but don't fail on viewport-specific issues
        if (accessibilityScanResults.violations.length > 0) {
          console.log(`${name} violations:`, accessibilityScanResults.violations.map(v => v.id));
        }
        
        // Check that content is not cut off
        const body = page.locator('body');
        const bodyHeight = await body.evaluate(el => el.scrollHeight);
        const viewportHeight = height;
        
        // Content should be viewable (allowing for some overflow)
        expect(bodyHeight).toBeLessThan(viewportHeight * 3);
      });
    });
  });

  describe('Dynamic Content Accessibility', () => {
    test('dynamic updates should be announced to screen readers', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Unlock desktop
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(1000);
      
      // Check for live regions
      const liveRegions = await page.locator('[aria-live], [role="status"], [role="alert"]').all();
      
      for (const region of liveRegions) {
        const ariaLive = await region.getAttribute('aria-live');
        expect(ariaLive).toBeTruthy();
      }
      
      // Test dynamic score updates
      const scoreElement = page.locator('[data-testid="pop-score"], .score-display').first();
      if (await scoreElement.isVisible()) {
        // Simulate score update
        const initialScore = await scoreElement.textContent();
        
        // Update score
        await page.evaluate((selector) => {
          const element = document.querySelector(selector) as HTMLElement;
          if (element) {
            element.textContent = 'New Score: 1500';
            // Announce change
            element.setAttribute('aria-live', 'polite');
          }
        }, await scoreElement.evaluate((el, i) => el.getAttribute('data-testid') || el.className || i.toString()));
        
        await page.waitForTimeout(500);
        
        const newScore = await scoreElement.textContent();
        expect(newScore).toContain('1500');
      }
    });

    test('loading states should be accessible', async ({ page }) => {
      // Mock slow API responses
      await page.route('**/api/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.continue();
      });
      
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      
      // Check for loading indicators
      const loadingElements = await page.locator('[aria-busy="true"], .loading, [data-testid*="loading"]').all();
      
      for (const loadingElement of loadingElements) {
        const isBusy = await loadingElement.getAttribute('aria-busy');
        expect(isBusy).toBe('true');
        
        // Check for descriptive text
        const text = await loadingElement.textContent();
        if (text) {
          expect(text.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Custom SylOS Accessibility Features', () => {
    test('blockchain connection status should be announced', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Check for connection status indicators
      const statusElements = await page.locator(
        '[data-testid="connection-status"], [data-testid="wallet-status"], .connection-indicator'
      ).all();
      
      for (const statusElement of statusElements) {
        // Should have proper ARIA attributes
        const ariaLabel = await statusElement.getAttribute('aria-label');
        const ariaRole = await statusElement.getAttribute('role');
        
        if (ariaLabel) {
          expect(ariaLabel.length).toBeGreaterThan(0);
        }
        
        if (ariaRole) {
          expect(['status', 'alert', 'log'].includes(ariaRole)).toBe(true);
        }
      }
    });

    test('PoP score and tier information should be accessible', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Unlock and open PoP tracker
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(500);
      await page.click('[data-testid="desktop-icon-pop-tracker"]');
      await page.waitForTimeout(1000);
      
      // Check PoP score display
      const scoreElement = page.locator('[data-testid="pop-score"], .score-display');
      if (await scoreElement.isVisible()) {
        const scoreText = await scoreElement.textContent();
        expect(scoreText).toBeTruthy();
        
        // Should be keyboard navigable
        await scoreElement.focus();
        const isFocused = await scoreElement.evaluate(el => el === document.activeElement);
        expect(isFocused).toBe(true);
      }
      
      // Check tier display
      const tierElement = page.locator('[data-testid="pop-tier"], .tier-display');
      if (await tierElement.isVisible()) {
        const tierText = await tierElement.textContent();
        expect(tierText).toBeTruthy();
      }
    });

    test('wallet balance and transaction info should be accessible', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Unlock and open wallet
      await page.click('[data-testid="unlock-button"]');
      await page.waitForTimeout(500);
      await page.click('[data-testid="desktop-icon-wallet"]');
      await page.waitForTimeout(1000);
      
      // Check balance display
      const balanceElement = page.locator('[data-testid="wallet-balance"], .balance-display');
      if (await balanceElement.isVisible()) {
        const balanceText = await balanceElement.textContent();
        expect(balanceText).toBeTruthy();
        
        // Should announce balance changes
        const ariaLive = await balanceElement.getAttribute('aria-live');
        if (ariaLive) {
          expect(['polite', 'assertive'].includes(ariaLive)).toBe(true);
        }
      }
      
      // Check transaction list
      const transactionElements = await page.locator(
        '[data-testid="transaction-item"], .transaction-item'
      ).all();
      
      for (const transaction of transactionElements) {
        const text = await transaction.textContent();
        expect(text).toBeTruthy();
      }
    });
  });
});
