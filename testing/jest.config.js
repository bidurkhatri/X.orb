const path = require('path');

module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'http://localhost',
    pretendToBeVisual: true,
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/configs/jest.setup.js',
    '<rootDir>/configs/jest.setupAfterEnv.js',
  ],

  // Test matching patterns
  testMatch: [
    '<rootDir>/unit/**/*.test.{js,ts,tsx}',
    '<rootDir>/unit/**/*.spec.{js,ts,tsx}',
    '<rootDir>/integration/**/*.test.{js,ts,tsx}',
    '<rootDir>/performance/**/*.test.{js,ts,tsx}',
    '<rootDir>/accessibility/**/*.test.{js,ts,tsx}',
    '<rootDir>/visual/**/*.test.{js,ts,tsx}',
  ],

  // Module file extensions
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],

  // Module name mapping
  moduleNameMapper: {
    // Handle module aliases
    '^@/(.*)$': '<rootDir>/../sylos-blockchain-os/src/$1',
    '^@components/(.*)$': '<rootDir>/../sylos-blockchain-os/src/components/$1',
    '^@utils/(.*)$': '<rootDir>/../sylos-blockchain-os/src/utils/$1',
    '^@hooks/(.*)$': '<rootDir>/../sylos-blockchain-os/src/hooks/$1',
    '^@types/(.*)$': '<rootDir>/../sylos-blockchain-os/src/types/$1',
    
    // CSS modules
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    
    // Handle static assets
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/configs/jest.assetMock.js',
  },

  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/',
    '<rootDir>/coverage/',
  ],

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    '../sylos-blockchain-os/src/**/*.{ts,tsx}',
    '!../sylos-blockchain-os/src/**/*.d.ts',
    '!../sylos-blockchain-os/src/main.tsx',
    '!../sylos-blockchain-os/src/vite-env.d.ts',
    '!../sylos-blockchain-os/src/index.css',
    '!../sylos-blockchain-os/src/App.css',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/components/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json',
  ],

  // Coverage output directories
  coverageDirectory: '<rootDir>/coverage/unit',

  // Test timeout
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Report test results
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/reports/unit',
        outputName: 'junit.xml',
        suiteName: 'SylOS Unit Tests',
      },
    ],
    [
      'jest-html-reporters',
      {
        publicPath: '<rootDir>/reports/unit',
        filename: 'report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'SylOS Unit Test Report',
      },
    ],
  ],

  // Error on deprecated features
  errorOnDeprecated: false,

  // Test runner
  runner: 'jest-runner',

  // Test results processors
  testResultsProcessor: undefined,
};