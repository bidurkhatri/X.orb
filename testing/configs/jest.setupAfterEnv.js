import '@testing-library/jest-dom';

// Custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
  
  toHaveBeenCalledWithTx(received, transaction) {
    const pass = received.mock.calls.some((call) => {
      return (
        call[0] &&
        call[0].from === transaction.from &&
        call[0].to === transaction.to &&
        call[0].data === transaction.data
      );
    });
    
    if (pass) {
      return {
        message: () => 'expected transaction not to have been called with the specified parameters',
        pass: true,
      };
    } else {
      return {
        message: () => 'expected transaction to have been called with the specified parameters',
        pass: false,
      };
    }
  },
  
  toBeValidEthereumAddress(received) {
    const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    const pass = ethereumAddressRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid Ethereum address`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid Ethereum address`,
        pass: false,
      };
    }
  },
  
  toBeValidCID(received) {
    const cidRegex = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
    const pass = cidRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid IPFS CID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid IPFS CID`,
        pass: false,
      };
    }
  },
});

// Setup cleanup after each test
afterEach(() => {
  // Clean up timers
  jest.clearAllTimers();
  jest.clearAllMocks();
  jest.restoreAllMocks();
  
  // Clean up any mounted components
  if (document.body) {
    document.body.innerHTML = '';
  }
});

// Setup before each test
beforeEach(() => {
  // Reset all mocks
  jest.clearAllMocks();
  
  // Reset localStorage
  localStorageMock.clear();
  sessionStorageMock.clear();
});

// Global test utilities
global.testUtils = {
  // Generate test wallet
  generateTestWallet: () => ({
    address: '0x' + Math.random().toString(16).substr(2, 40),
    privateKey: '0x' + Math.random().toString(16).substr(2, 64),
  }),
  
  // Generate test IPFS CID
  generateTestCID: () => {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = 'Qm';
    for (let i = 0; i < 44; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },
  
  // Mock Web3 transaction
  createMockTransaction: (options = {}) => ({
    from: '0x1234567890123456789012345678901234567890',
    to: '0xabcdef1234567890abcdef1234567890abcdef1234',
    data: '0x0000000000000000000000000000000000000000',
    value: '0x0',
    gas: '0x5208',
    ...options,
  }),
  
  // Wait for async operations
  waitFor: (condition, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
        if (condition()) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  },
};