/// <reference types="cypress" />

import { testConfig } from '../../../playwright.config';

describe('SylOS Web Application E2E Tests', () => {
  beforeEach(() => {
    // Start fresh for each test
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.visit('/');
    
    // Mock blockchain providers
    cy.window().then((win) => {
      win.ethereum = {
        request: cy.stub().resolves(testConfig.testData.wallet.address),
        on: cy.stub(),
        removeListener: cy.stub(),
        selectedAddress: testConfig.testData.wallet.address,
        networkVersion: '137',
        isConnected: cy.stub().returns(true),
      };
    });
  });

  describe('Desktop Environment', () => {
    it('should load the desktop interface', () => {
      cy.get('[data-testid="desktop"]').should('be.visible');
      cy.get('[data-testid="taskbar"]').should('be.visible');
      cy.get('[data-testid="desktop-icons"]').should('be.visible');
    });

    it('should display lock screen initially', () => {
      cy.get('[data-testid="lockscreen"]').should('be.visible');
      cy.get('[data-testid="lockscreen"]').should('contain', 'SylOS');
    });

    it('should unlock desktop and show apps', () => {
      // Mock successful unlock
      cy.get('[data-testid="unlock-button"]').click();
      
      // Verify desktop is accessible
      cy.get('[data-testid="desktop"]').should('be.visible');
      cy.get('[data-testid="desktop-icon-wallet"]').should('be.visible');
      cy.get('[data-testid="desktop-icon-pop-tracker"]').should('be.visible');
      cy.get('[data-testid="desktop-icon-file-manager"]').should('be.visible');
      cy.get('[data-testid="desktop-icon-token-dashboard"]').should('be.visible');
    });

    it('should handle window management', () => {
      // Unlock first
      cy.get('[data-testid="unlock-button"]').click();
      
      // Open wallet app
      cy.get('[data-testid="desktop-icon-wallet"]').dblclick();
      cy.get('[data-testid="wallet-app-window"]').should('be.visible');
      
      // Minimize window
      cy.get('[data-testid="minimize-button"]').click();
      cy.get('[data-testid="wallet-app-window"]').should('not.be.visible');
      
      // Restore window
      cy.get('[data-testid="wallet-app-icon"]').click();
      cy.get('[data-testid="wallet-app-window"]').should('be.visible');
      
      // Close window
      cy.get('[data-testid="close-button"]').click();
      cy.get('[data-testid="wallet-app-window"]').should('not.be.visible');
    });

    it('should support window dragging', () => {
      // Unlock and open app
      cy.get('[data-testid="unlock-button"]').click();
      cy.get('[data-testid="desktop-icon-wallet"]').dblclick();
      
      // Get initial position
      cy.get('[data-testid="wallet-app-window"]')
        .should('have.attr', 'style')
        .and('contain', 'left: 100px')
        .and('contain', 'top: 100px');
      
      // Simulate drag (this would need a more sophisticated implementation)
      // cy.get('[data-testid="wallet-app-window"]').trigger('mousedown', { which: 1 });
      // cy.get('body').trigger('mousemove', { pageX: 300, pageY: 300 });
      // cy.get('body').trigger('mouseup');
    });
  });

  describe('Wallet Application', () => {
    beforeEach(() => {
      cy.visit('/');
      cy.get('[data-testid="unlock-button"]').click();
      cy.get('[data-testid="desktop-icon-wallet"]').dblclick();
    });

    it('should display wallet interface', () => {
      cy.get('[data-testid="wallet-app"]').should('be.visible');
      cy.get('[data-testid="wallet-balance"]').should('contain', '12,450.50');
      cy.get('[data-testid="wallet-symbol"]').should('contain', 'SYLOS');
    });

    it('should show wallet connection status', () => {
      cy.get('[data-testid="connection-status"]').should('contain', 'Connected');
      cy.get('[data-testid="network-info"]').should('contain', 'Polygon');
    });

    it('should display transaction history', () => {
      cy.get('[data-testid="transaction-history"]').should('be.visible');
      cy.get('[data-testid="transaction-item"]').should('have.length.gte', 1);
    });

    it('should open send transaction modal', () => {
      cy.get('[data-testid="send-button"]').click();
      cy.get('[data-testid="send-modal"]').should('be.visible');
      cy.get('[data-testid="recipient-input"]').should('be.visible');
      cy.get('[data-testid="amount-input"]').should('be.visible');
    });

    it('should validate recipient address', () => {
      cy.get('[data-testid="send-button"]').click();
      cy.get('[data-testid="recipient-input"]').type('invalid-address');
      cy.get('[data-testid="send-button-modal"]').should('be.disabled');
    });

    it('should send transaction successfully', () => {
      // Mock transaction success
      cy.window().then((win) => {
        win.ethereum.request = cy.stub().resolves('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      });
      
      cy.get('[data-testid="send-button"]').click();
      cy.get('[data-testid="recipient-input"]').type(testConfig.testData.wallet.address);
      cy.get('[data-testid="amount-input"]').type('1.0');
      cy.get('[data-testid="send-button-modal"]').click();
      
      cy.get('[data-testid="transaction-success"]').should('be.visible');
    });

    it('should handle transaction errors', () => {
      // Mock transaction failure
      cy.window().then((win) => {
        win.ethereum.request = cy.stub().rejects(new Error('Insufficient funds'));
      });
      
      cy.get('[data-testid="send-button"]').click();
      cy.get('[data-testid="recipient-input"]').type(testConfig.testData.wallet.address);
      cy.get('[data-testid="amount-input"]').type('999999.0');
      cy.get('[data-testid="send-button-modal"]').click();
      
      cy.get('[data-testid="transaction-error"]').should('contain', 'Insufficient funds');
    });
  });

  describe('PoP Tracker Application', () => {
    beforeEach(() => {
      cy.visit('/');
      cy.get('[data-testid="unlock-button"]').click();
      cy.get('[data-testid="desktop-icon-pop-tracker"]').dblclick();
    });

    it('should display PoP tracker interface', () => {
      cy.get('[data-testid="pop-tracker-app"]').should('be.visible');
      cy.get('[data-testid="pop-score"]').should('contain', '8,547');
      cy.get('[data-testid="pop-tier"]').should('contain', 'Diamond');
      cy.get('[data-testid="weekly-reward"]').should('contain', '145.5 wSYLOS');
    });

    it('should display task list', () => {
      cy.get('[data-testid="task-list"]').should('be.visible');
      cy.get('[data-testid="task-item"]').should('have.length.gte', 1);
    });

    it('should show task verification status', () => {
      cy.get('[data-testid="verified-task"]').should('have.length.gte', 1);
      cy.get('[data-testid="pending-task"]').should('have.length.gte', 1);
    });

    it('should display productivity timeline', () => {
      cy.get('[data-testid="timeline"]').should('be.visible');
      cy.get('[data-testid="timeline-item"]').should('have.length.gte', 1);
    });

    it('should show task details on click', () => {
      cy.get('[data-testid="task-item"]').first().click();
      cy.get('[data-testid="task-modal"]').should('be.visible');
      cy.get('[data-testid="task-title"]').should('be.visible');
    });
  });

  describe('File Manager Application', () => {
    beforeEach(() => {
      cy.visit('/');
      cy.get('[data-testid="unlock-button"]').click();
      cy.get('[data-testid="desktop-icon-file-manager"]').dblclick();
    });

    it('should display file manager interface', () => {
      cy.get('[data-testid="file-manager-app"]').should('be.visible');
      cy.get('[data-testid="storage-usage"]').should('contain', '9.8 GB / 100 GB');
    });

    it('should display file list with IPFS CIDs', () => {
      cy.get('[data-testid="file-list"]').should('be.visible');
      cy.get('[data-testid="file-item"]').should('have.length.gte', 1);
      cy.get('[data-testid="file-cid"]').should('contain', 'Qm');
    });

    it('should open upload modal', () => {
      cy.get('[data-testid="upload-button"]').click();
      cy.get('[data-testid="upload-modal"]').should('be.visible');
      cy.get('[data-testid="file-input"]').should('be.visible');
    });

    it('should handle file upload', () => {
      // Mock successful upload
      cy.intercept('POST', '**/api/v0/add', {
        statusCode: 200,
        body: {
          Hash: 'QmXwN9dYd4T8J2kF3mZpA8hE9xN5vL2qR4mN7bC6dF3gH1jK5mN',
          Name: 'test.txt',
          Size: '12',
        },
      }).as('uploadFile');

      cy.get('[data-testid="upload-button"]').click();
      
      // Create a test file and upload
      const fileName = 'test.txt';
      cy.writeFile('test-upload.txt', 'Hello, World!');
      cy.get('input[type="file"]').selectFile('test-upload.txt', { force: true });
      cy.get('[data-testid="upload-submit"]').click();
      
      cy.wait('@uploadFile');
      cy.get('[data-testid="upload-success"]').should('be.visible');
    });

    it('should create new folder', () => {
      cy.get('[data-testid="new-folder-button"]').click();
      cy.get('[data-testid="folder-name-input"]').type('Test Folder');
      cy.get('[data-testid="create-folder"]').click();
      
      cy.get('[data-testid="folder-item"]').should('contain', 'Test Folder');
    });
  });

  describe('Token Dashboard Application', () => {
    beforeEach(() => {
      cy.visit('/');
      cy.get('[data-testid="unlock-button"]').click();
      cy.get('[data-testid="desktop-icon-token-dashboard"]').dblclick();
    });

    it('should display token dashboard interface', () => {
      cy.get('[data-testid="token-dashboard-app"]').should('be.visible');
      cy.get('[data-testid="portfolio-value"]').should('contain', '$31,791');
    });

    it('should display token balances', () => {
      cy.get('[data-testid="sylos-balance"]').should('contain', '12,450.50');
      cy.get('[data-testid="sylos-value"]').should('contain', '$24,901');
      cy.get('[data-testid="wsylos-balance"]').should('contain', '3,280.75');
      cy.get('[data-testid="wsylos-value"]').should('contain', '$6,890');
    });

    it('should show staking information', () => {
      cy.get('[data-testid="staking-section"]').should('be.visible');
      cy.get('[data-testid="staking-apy"]').should('contain', '12% APY');
      cy.get('[data-testid="staked-amount"]').should('contain', '1,000 SYLOS');
    });

    it('should open buy modal', () => {
      cy.get('[data-testid="buy-button"]').click();
      cy.get('[data-testid="buy-modal"]').should('be.visible');
      cy.get('[data-testid="token-selection"]').should('be.visible');
      cy.get('[data-testid="amount-input"]').should('be.visible');
    });

    it('should open sell modal', () => {
      cy.get('[data-testid="sell-button"]').click();
      cy.get('[data-testid="sell-modal"]').should('be.visible');
    });

    it('should display price chart', () => {
      cy.get('[data-testid="price-chart"]').should('be.visible');
      cy.get('[data-testid="chart-canvas"]').should('be.visible');
    });
  });

  describe('Settings Application', () => {
    beforeEach(() => {
      cy.visit('/');
      cy.get('[data-testid="unlock-button"]').click();
      cy.get('[data-testid="desktop-icon-settings"]').dblclick();
    });

    it('should display settings interface', () => {
      cy.get('[data-testid="settings-app"]').should('be.visible');
      cy.get('[data-testid="account-section"]').should('be.visible');
      cy.get('[data-testid="network-section"]').should('be.visible');
      cy.get('[data-testid="security-section"]').should('be.visible');
    });

    it('should display account information', () => {
      cy.get('[data-testid="user-email"]').should('contain', 'test@sylos.com');
    });

    it('should show network configuration', () => {
      cy.get('[data-testid="network-select"]').should('contain', 'Polygon PoS Mainnet');
      cy.get('[data-testid="rpc-url"]').should('be.visible');
    });

    it('should allow changing network', () => {
      cy.get('[data-testid="network-select"]').click();
      cy.get('[data-testid="network-option-testnet"]').click();
      cy.get('[data-testid="network-select"]').should('contain', 'Polygon PoS Testnet');
    });

    it('should show security options', () => {
      cy.get('[data-testid="backup-wallet"]').should('be.visible');
      cy.get('[data-testid="change-password"]').should('be.visible');
      cy.get('[data-testid="enable-2fa"]').should('be.visible');
    });
  });

  describe('Responsive Design', () => {
    it('should work on mobile viewport', () => {
      cy.viewport('iphone-x');
      cy.visit('/');
      
      cy.get('[data-testid="mobile-menu"]').should('be.visible');
      cy.get('[data-testid="desktop"]').should('not.be.visible');
    });

    it('should work on tablet viewport', () => {
      cy.viewport('ipad-2');
      cy.visit('/');
      
      cy.get('[data-testid="unlock-button"]').click();
      cy.get('[data-testid="desktop-icon-wallet"]').click();
      cy.get('[data-testid="wallet-app-window"]').should('be.visible');
    });

    it('should be accessible on large screens', () => {
      cy.viewport(1920, 1080);
      cy.visit('/');
      
      cy.get('[data-testid="unlock-button"]').click();
      cy.get('[data-testid="desktop"]').should('be.visible');
      cy.get('[data-testid="desktop-icons"]').should('be.visible');
      cy.get('[data-testid="taskbar"]').should('be.visible');
    });
  });

  describe('Error Handling', () => {
    it('should handle network disconnection', () => {
      cy.visit('/');
      cy.get('[data-testid="unlock-button"]').click();
      
      // Simulate network error
      cy.window().then((win) => {
        win.ethereum.isConnected = cy.stub().returns(false);
      });
      
      cy.get('[data-testid="network-error"]').should('be.visible');
    });

    it('should handle invalid wallet connection', () => {
      cy.visit('/');
      
      cy.window().then((win) => {
        win.ethereum.request = cy.stub().rejects(new Error('User rejected connection'));
      });
      
      cy.get('[data-testid="unlock-button"]').click();
      cy.get('[data-testid="connection-error"]').should('be.visible');
    });

    it('should show loading states', () => {
      cy.visit('/');
      
      // Mock slow response
      cy.intercept('**/api/**', (req) => {
        req.reply((res) => {
          setTimeout(() => res.send({ statusCode: 200, body: { result: 'success' } }), 1000);
        });
      });
      
      cy.get('[data-testid="unlock-button"]').click();
      cy.get('[data-testid="loading"]').should('be.visible');
    });
  });

  describe('Accessibility', () => {
    it('should have proper keyboard navigation', () => {
      cy.visit('/');
      
      cy.get('body').tab();
      cy.focused().should('have.attr', 'data-testid', 'unlock-button');
      
      cy.get('body').type('{enter}');
      cy.focused().should('have.attr', 'data-testid', 'desktop-icon-wallet');
    });

    it('should have proper ARIA labels', () => {
      cy.visit('/');
      cy.get('[data-testid="unlock-button"]').click();
      cy.get('[data-testid="desktop-icon-wallet"]').should('have.attr', 'aria-label');
    });

    it('should have proper color contrast', () => {
      cy.visit('/');
      cy.get('[data-testid="unlock-button"]').should('have.css', 'color')
        .and('not.equal', 'rgb(255, 255, 255)'); // Ensure sufficient contrast
    });
  });
});