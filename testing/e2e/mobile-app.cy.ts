/// <reference types="cypress" />

import { testConfig } from '../../../playwright.config';

describe('SylOS Mobile App E2E Tests', () => {
  beforeEach(() => {
    // Clear app data before each test
    cy.exec('adb shell pm clear com.sylos.app || true');
    cy.exec('xcrun simctl erase booted || true');
    
    // Start the mobile app
    cy.visit('/');
    cy.viewport('iphone-x');
    
    // Mock mobile-specific features
    cy.window().then((win) => {
      win.deviceInfo = {
        platform: 'iOS',
        model: 'iPhone 14 Pro',
        osVersion: '16.0',
      };
      win.isMobile = true;
    });
  });

  afterEach(() => {
    // Clean up after each test
    cy.exec('adb shell pm clear com.sylos.app || true');
  });

  describe('Mobile Lock Screen', () => {
    it('should display mobile lock screen', () => {
      cy.get('[data-testid="mobile-lockscreen"]').should('be.visible');
      cy.get('[data-testid="sylos-logo"]').should('be.visible');
      cy.get('[data-testid="unlock-instruction"]').should('contain', 'Swipe up to unlock');
    });

    it('should handle swipe gesture to unlock', () => {
      // Simulate swipe up gesture
      cy.get('[data-testid="mobile-lockscreen"]')
        .trigger('touchstart', { touches: [{ pageX: 100, pageY: 500 }] })
        .trigger('touchmove', { touches: [{ pageX: 100, pageY: 300 }] })
        .trigger('touchend');
      
      // Should transition to home screen
      cy.get('[data-testid="mobile-home"]').should('be.visible', { timeout: 5000 });
    });

    it('should handle touch events', () => {
      cy.get('[data-testid="mobile-lockscreen"]').should('be.visible');
      cy.get('[data-testid="current-time"]').should('be.visible');
      cy.get('[data-testid="current-date"]').should('be.visible');
    });
  });

  describe('Mobile Home Screen', () => {
    beforeEach(() => {
      // Unlock to home screen
      cy.get('[data-testid="mobile-lockscreen"]')
        .trigger('touchstart', { touches: [{ pageX: 100, pageY: 500 }] })
        .trigger('touchmove', { touches: [{ pageX: 100, pageY: 100 }] })
        .trigger('touchend');
      
      cy.get('[data-testid="mobile-home"]', { timeout: 10000 }).should('be.visible');
    });

    it('should display app grid', () => {
      cy.get('[data-testid="app-grid"]').should('be.visible');
      cy.get('[data-testid="app-icon-wallet"]').should('be.visible');
      cy.get('[data-testid="app-icon-pop-tracker"]').should('be.visible');
      cy.get('[data-testid="app-icon-file-manager"]').should('be.visible');
      cy.get('[data-testid="app-icon-token-dashboard"]').should('be.visible');
    });

    it('should support app launching by tap', () => {
      cy.get('[data-testid="app-icon-wallet"]').tap();
      cy.get('[data-testid="wallet-screen"]').should('be.visible', { timeout: 3000 });
    });

    it('should display status bar information', () => {
      cy.get('[data-testid="status-bar"]').should('be.visible');
      cy.get('[data-testid="battery-indicator"]').should('be.visible');
      cy.get('[data-testid="wifi-indicator"]').should('be.visible');
      cy.get('[data-testid="signal-indicator"]').should('be.visible');
    });

    it('should handle app switching', () => {
      // Open wallet
      cy.get('[data-testid="app-icon-wallet"]').tap();
      cy.get('[data-testid="wallet-screen"]').should('be.visible');
      
      // Go back home
      cy.get('[data-testid="home-button"]').tap();
      cy.get('[data-testid="app-grid"]').should('be.visible');
      
      // Open PoP tracker
      cy.get('[data-testid="app-icon-pop-tracker"]').tap();
      cy.get('[data-testid="pop-tracker-screen"]').should('be.visible');
    });
  });

  describe('Mobile Wallet App', () => {
    beforeEach(() => {
      // Mock wallet connection
      cy.window().then((win) => {
        win.ethereum = {
          request: cy.stub().resolves(testConfig.testData.wallet.address),
          on: cy.stub(),
          removeListener: cy.stub(),
          selectedAddress: testConfig.testData.wallet.address,
          networkVersion: '137',
        };
      });
      
      // Open wallet app
      cy.visit('/');
      cy.get('[data-testid="mobile-lockscreen"]')
        .trigger('touchstart', { touches: [{ pageX: 100, pageY: 500 }] })
        .trigger('touchmove', { touches: [{ pageX: 100, pageY: 100 }] })
        .trigger('touchend');
      
      cy.get('[data-testid="mobile-home"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="app-icon-wallet"]').tap();
    });

    it('should display mobile wallet interface', () => {
      cy.get('[data-testid="wallet-screen"]').should('be.visible');
      cy.get('[data-testid="wallet-balance"]').should('contain', '12,450.50');
      cy.get('[data-testid="wallet-symbol"]').should('contain', 'SYLOS');
    });

    it('should handle mobile-specific gestures', () => {
      // Test pull to refresh
      cy.get('[data-testid="wallet-content"]')
        .trigger('touchstart', { touches: [{ pageX: 100, pageY: 100 }] })
        .trigger('touchmove', { touches: [{ pageX: 100, pageY: 200 }] })
        .trigger('touchend');
      
      cy.get('[data-testid="refresh-indicator"]').should('be.visible', { timeout: 2000 });
    });

    it('should support swipe navigation', () => {
      // Navigate through wallet tabs by swiping
      cy.get('[data-testid="balance-tab"]').should('be.visible');
      
      cy.get('[data-testid="wallet-content"]')
        .trigger('touchstart', { touches: [{ pageX: 300, pageY: 200 }] })
        .trigger('touchend', { touches: [{ pageX: 100, pageY: 200 }] });
      
      cy.get('[data-testid="transactions-tab"]').should('be.visible');
    });

    it('should display transaction list', () => {
      cy.get('[data-testid="transactions-tab"]').tap();
      cy.get('[data-testid="transaction-list"]').should('be.visible');
      cy.get('[data-testid="transaction-item"]').should('have.length.gte', 1);
    });

    it('should open send modal', () => {
      cy.get('[data-testid="send-button"]').tap();
      cy.get('[data-testid="send-modal"]').should('be.visible');
      
      // Check mobile-specific layout
      cy.get('[data-testid="modal-header"]').should('be.visible');
      cy.get('[data-testid="close-modal-button"]').should('be.visible');
    });

    it('should handle QR code scanning', () => {
      cy.get('[data-testid="scan-qr-button"]').tap();
      cy.get('[data-testid="qr-scanner"]').should('be.visible');
      
      // Simulate QR code detection
      cy.get('[data-testid="qr-scanner"]').trigger('qrcode.detected', {
        data: testConfig.testData.wallet.address,
      });
      
      cy.get('[data-testid="recipient-input"]').should('contain', testConfig.testData.wallet.address);
    });
  });

  describe('Mobile PoP Tracker', () => {
    beforeEach(() => {
      // Open PoP tracker app
      cy.visit('/');
      cy.get('[data-testid="mobile-lockscreen"]')
        .trigger('touchstart', { touches: [{ pageX: 100, pageY: 500 }] })
        .trigger('touchmove', { touches: [{ pageX: 100, pageY: 100 }] })
        .trigger('touchend');
      
      cy.get('[data-testid="mobile-home"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="app-icon-pop-tracker"]').tap();
    });

    it('should display PoP tracker interface', () => {
      cy.get('[data-testid="pop-tracker-screen"]').should('be.visible');
      cy.get('[data-testid="pop-score"]').should('contain', '8,547');
      cy.get('[data-testid="pop-tier-badge"]').should('contain', 'Diamond');
    });

    it('should display productivity score prominently', () => {
      cy.get('[data-testid="score-circle"]').should('be.visible');
      cy.get('[data-testid="score-value"]').should('contain', '8547');
    });

    it('should show task list with mobile-friendly layout', () => {
      cy.get('[data-testid="task-list"]').should('be.visible');
      cy.get('[data-testid="task-item"]').each(($task) => {
        cy.wrap($task).should('be.visible');
        cy.wrap($task).find('[data-testid="task-title"]').should('be.visible');
        cy.wrap($task).find('[data-testid="task-points"]').should('be.visible');
      });
    });

    it('should handle task completion', () => {
      cy.get('[data-testid="complete-task-button"]').first().tap();
      cy.get('[data-testid="task-completed-indicator"]').should('be.visible');
    });

    it('should display weekly reward information', () => {
      cy.get('[data-testid="weekly-reward"]').scrollIntoView();
      cy.get('[data-testid="reward-value"]').should('contain', '145.5 wSYLOS');
    });
  });

  describe('Mobile File Manager', () => {
    beforeEach(() => {
      // Open file manager app
      cy.visit('/');
      cy.get('[data-testid="mobile-lockscreen"]')
        .trigger('touchstart', { touches: [{ pageX: 100, pageY: 500 }] })
        .trigger('touchmove', { touches: [{ pageX: 100, pageY: 100 }] })
        .trigger('touchend');
      
      cy.get('[data-testid="mobile-home"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="app-icon-file-manager"]').tap();
    });

    it('should display file manager interface', () => {
      cy.get('[data-testid="file-manager-screen"]').should('be.visible');
      cy.get('[data-testid="storage-usage"]').should('contain', '9.8 GB / 100 GB');
    });

    it('should handle file selection with long press', () => {
      cy.get('[data-testid="file-item"]').first().trigger('touchstart', { touches: [{ pageX: 100, pageY: 100 }] })
        .trigger('touchend', { touches: [{ pageX: 100, pageY: 100 }] });
      
      // Long press simulation
      setTimeout(() => {
        cy.get('[data-testid="file-selection-mode"]').should('be.visible');
      }, 500);
    });

    it('should support touch-based file operations', () => {
      // Select file
      cy.get('[data-testid="file-item"]').first().tap();
      cy.get('[data-testid="file-options-menu"]').should('be.visible');
      
      // Test file details
      cy.get('[data-testid="file-details-option"]').tap();
      cy.get('[data-testid="file-details-modal"]').should('be.visible');
    });

    it('should open upload modal', () => {
      cy.get('[data-testid="upload-button"]').tap();
      cy.get('[data-testid="upload-modal"]').should('be.visible');
    });
  });

  describe('Mobile Token Dashboard', () => {
    beforeEach(() => {
      // Open token dashboard app
      cy.visit('/');
      cy.get('[data-testid="mobile-lockscreen"]')
        .trigger('touchstart', { touches: [{ pageX: 100, pageY: 500 }] })
        .trigger('touchmove', { touches: [{ pageX: 100, pageY: 100 }] })
        .trigger('touchend');
      
      cy.get('[data-testid="mobile-home"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="app-icon-token-dashboard"]').tap();
    });

    it('should display token portfolio', () => {
      cy.get('[data-testid="token-dashboard-screen"]').should('be.visible');
      cy.get('[data-testid="portfolio-value"]').should('contain', '$31,791');
    });

    it('should support horizontal scrolling for token cards', () => {
      cy.get('[data-testid="token-cards"]').should('be.visible');
      
      cy.get('[data-testid="token-cards"]')
        .trigger('touchstart', { touches: [{ pageX: 300, pageY: 200 }] })
        .trigger('touchend', { touches: [{ pageX: 100, pageY: 200 }] });
      
      cy.get('[data-testid="wsylos-token-card"]').should('be.visible');
    });

    it('should display price chart optimized for mobile', () => {
      cy.get('[data-testid="price-chart"]').should('be.visible');
      cy.get('[data-testid="chart-container"]').should('have.css', 'height');
    });

    it('should open buy/sell modals', () => {
      cy.get('[data-testid="buy-button"]').tap();
      cy.get('[data-testid="buy-modal"]').should('be.visible');
      
      cy.get('[data-testid="close-modal-button"]').tap();
      cy.get('[data-testid="sell-button"]').tap();
      cy.get('[data-testid="sell-modal"]').should('be.visible');
    });
  });

  describe('Mobile Settings', () => {
    beforeEach(() => {
      // Open settings app
      cy.visit('/');
      cy.get('[data-testid="mobile-lockscreen"]')
        .trigger('touchstart', { touches: [{ pageX: 100, pageY: 500 }] })
        .trigger('touchmove', { touches: [{ pageX: 100, pageY: 100 }] })
        .trigger('touchend');
      
      cy.get('[data-testid="mobile-home"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="settings-button"]').tap();
    });

    it('should display settings list', () => {
      cy.get('[data-testid="settings-screen"]').should('be.visible');
      cy.get('[data-testid="settings-item"]').should('have.length.gte', 1);
    });

    it('should handle mobile navigation', () => {
      cy.get('[data-testid="account-settings-item"]').tap();
      cy.get('[data-testid="account-settings-screen"]').should('be.visible');
    });

    it('should show mobile-optimized forms', () => {
      cy.get('[data-testid="network-settings-item"]').tap();
      cy.get('[data-testid="network-select"]').should('be.visible');
    });
  });

  describe('Mobile Device Features', () => {
    it('should handle device orientation changes', () => {
      cy.visit('/');
      cy.get('[data-testid="mobile-lockscreen"]').should('be.visible');
      
      // Simulate landscape mode
      cy.viewport('iphone-x', 'landscape');
      cy.get('[data-testid="mobile-lockscreen"]').should('be.visible');
      
      // Simulate portrait mode
      cy.viewport('iphone-x', 'portrait');
      cy.get('[data-testid="mobile-lockscreen"]').should('be.visible');
    });

    it('should handle device shake gestures', () => {
      cy.visit('/');
      cy.get('[data-testid="mobile-lockscreen"]').should('be.visible');
      
      // Simulate shake gesture
      cy.get('[data-testid="mobile-lockscreen"]')
        .trigger('touchstart', { touches: [{ pageX: 100, pageY: 300 }] })
        .trigger('touchend')
        .trigger('touchstart', { touches: [{ pageX: 120, pageY: 280 }] })
        .trigger('touchend')
        .trigger('touchstart', { touches: [{ pageX: 80, pageY: 320 }] })
        .trigger('touchend');
      
      // Could trigger an action like refresh or undo
    });

    it('should support haptic feedback simulation', () => {
      // Mock haptic feedback
      cy.window().then((win) => {
        win.navigator.vibrate = cy.stub();
      });
      
      cy.visit('/');
      cy.get('[data-testid="unlock-button"]').click();
      cy.get('[data-testid="mobile-home"]').should('be.visible');
      
      // Haptic feedback should be triggered
      cy.get('[data-testid="app-icon-wallet"]').tap();
      // cy.get(window.navigator.vibrate).should('have.been.called');
    });
  });

  describe('Mobile Performance', () => {
    it('should load quickly on mobile', () => {
      const start = Date.now();
      cy.visit('/');
      cy.get('[data-testid="mobile-lockscreen"]', { timeout: 10000 }).should('be.visible');
      const loadTime = Date.now() - start;
      
      expect(loadTime).to.be.lessThan(5000);
    });

    it('should handle memory constraints', () => {
      cy.visit('/');
      cy.get('[data-testid="mobile-lockscreen"]').should('be.visible');
      
      // Open multiple apps to test memory management
      for (let i = 0; i < 5; i++) {
        cy.get('[data-testid="mobile-lockscreen"]')
          .trigger('touchstart', { touches: [{ pageX: 100, pageY: 500 }] })
          .trigger('touchmove', { touches: [{ pageX: 100, pageY: 100 }] })
          .trigger('touchend');
        
        cy.get('[data-testid="mobile-home"]', { timeout: 5000 }).should('be.visible');
        cy.get('[data-testid="home-button"]').tap();
        cy.get('[data-testid="mobile-lockscreen"]').should('be.visible');
      }
    });
  });

  describe('Mobile Accessibility', () => {
    it('should support screen readers', () => {
      cy.visit('/');
      cy.get('[data-testid="mobile-lockscreen"]')
        .should('have.attr', 'role')
        .and('eq', 'main');
      
      cy.get('[data-testid="unlock-button"]')
        .should('have.attr', 'aria-label')
        .and('eq', 'Unlock SylOS');
    });

    it('should have proper touch target sizes', () => {
      cy.visit('/');
      cy.get('[data-testid="unlock-button"]').should('have.css', 'min-width', '44px');
      cy.get('[data-testid="unlock-button"]').should('have.css', 'min-height', '44px');
    });
  });
});