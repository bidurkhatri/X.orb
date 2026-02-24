const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    // Base URL for the application
    baseUrl: 'http://localhost:3000',
    
    // Viewport settings
    viewportWidth: 1280,
    viewportHeight: 720,
    
    // Test files pattern
    specPattern: 'e2e/**/*.cy.{js,jsx,ts,tsx}',
    
    // Support file
    supportFile: 'e2e/support/e2e.js',
    
    // Fixtures folder
    fixturesFolder: 'e2e/fixtures',
    
    // Screenshots and videos
    screenshotsFolder: 'e2e/screenshots',
    videosFolder: 'e2e/videos',
    video: true,
    screenshotOnRunFailure: true,
    
    // Timeouts
    defaultCommandTimeout: 10000,
    pageLoadTimeout: 30000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    
    // Browser settings
    chromeWebSecurity: false,
    
    // Environment variables
    env: {
      apiUrl: 'http://localhost:3000/api',
      testNetwork: 'testnet',
      mockWallet: true,
      testUser: 'testuser@example.com',
    },
    
    // Retry settings
    retries: {
      runMode: 2,
      openMode: 0,
    },
    
    // Test settings
    testIsolation: true,
    hideXHRInCommandLog: true,
    
    setupNodeEvents(on, config) {
      // Implement node event listeners here
      
      // Task for seeding database
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        
        seedDatabase() {
          // Database seeding logic
          return null;
        },
        
        clearDatabase() {
          // Database clearing logic
          return null;
        },
      });
      
      // Plugin for handling file downloads
      on('before:browser:launch', (browser = {}, launchOptions) => {
        if (browser.family === 'chromium' && browser.name !== 'electron') {
          // Configure download directory
          launchOptions.preferences.default_content_settings = {
            popups: 0,
          };
          launchOptions.preferences.default_content_setting_values = {
            notifications: 2,
          };
        }
        return launchOptions;
      });
      
      // Network stubbing
      on('network:before:request', (request) => {
        // Log network requests
        console.log('Request:', request.method, request.url);
      });
      
      return config;
    },
  },
  
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    specPattern: 'e2e/components/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'e2e/support/component.js',
  },
  
  // Global configuration
  projectId: 'sylos-testing',
  watchForFileChanges: false,
  trashAssetsBeforeRuns: true,
  
  // Reporter configuration
  reporter: 'mochawesome',
  reporterOptions: {
    configFile: 'reporter-config.json',
  },
});