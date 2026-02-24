import {
  validateEthereumAddress,
  formatEthereumAddress,
  formatTokenAmount,
  calculateGasEstimate,
  generateWallet,
  hashFile,
  encodeCID,
  decodeCID,
  isValidPoPScore,
  calculateProductivityTier,
  estimateWeeklyReward,
  generateTransactionId,
  formatTimestamp,
  isValidIPFSCID,
  convertToWei,
  convertFromWei,
} from '../src/utils/blockchain';

describe('Blockchain Utilities', () => {
  describe('Address Validation', () => {
    it('should validate correct Ethereum addresses', () => {
      const validAddresses = [
        '0x1234567890123456789012345678901234567890',
        '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
        '0xabcdef1234567890abcdef1234567890abcdef12',
      ];

      validAddresses.forEach((address) => {
        expect(validateEthereumAddress(address)).toBe(true);
      });
    });

    it('should reject invalid Ethereum addresses', () => {
      const invalidAddresses = [
        '1234567890123456789012345678901234567890', // Missing 0x
        '0x123', // Too short
        '0x123456789012345678901234567890123456789012345', // Too long
        '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG', // Invalid characters
        '', // Empty string
        'not an address',
      ];

      invalidAddresses.forEach((address) => {
        expect(validateEthereumAddress(address)).toBe(false);
      });
    });

    it('should format Ethereum addresses', () => {
      const fullAddress = '0x1234567890123456789012345678901234567890';
      const shortAddress = formatEthereumAddress(fullAddress);
      
      expect(shortAddress).toBe('0x1234...7890');
    });

    it('should format addresses with different lengths', () => {
      const shortAddress = formatEthereumAddress('0x1234567890123456789012345678901234567890', 4, 6);
      expect(shortAddress).toBe('0x1234...567890');
      
      const longShort = formatEthereumAddress('0x1234567890123456789012345678901234567890', 2, 8);
      expect(longShort).toBe('0x12...12345678');
    });
  });

  describe('Token Amount Formatting', () => {
    it('should format token amounts correctly', () => {
      expect(formatTokenAmount('1000000000000000000')).toBe('1.0');
      expect(formatTokenAmount('123456789012345678')).toBe('0.123456789');
      expect(formatTokenAmount('0')).toBe('0.0');
    });

    it('should handle different decimal places', () => {
      expect(formatTokenAmount('1000000000000000000', 2)).toBe('1.00');
      expect(formatTokenAmount('1000000000000000000', 8)).toBe('1.00000000');
    });

    it('should handle very small amounts', () => {
      expect(formatTokenAmount('1')).toBe('0.000000000000000001');
      expect(formatTokenAmount('1000000')).toBe('0.000001');
    });
  });

  describe('Gas Estimation', () => {
    it('should calculate gas estimates', () => {
      const simpleTx = { to: '0x1234567890123456789012345678901234567890', value: '0x0' };
      const gasEstimate = calculateGasEstimate(simpleTx);
      
      expect(gasEstimate).toBeGreaterThan(20000);
      expect(gasEstimate).toBeLessThan(100000);
    });

    it('should account for data in transaction', () => {
      const simpleTx = { to: '0x1234567890123456789012345678901234567890', value: '0x0' };
      const complexTx = {
        to: '0x1234567890123456789012345678901234567890',
        value: '0x0',
        data: '0xa9059cbb000000000000000000000000abcdef1234567890abcdef1234567890abcdef12000000000000000000000000000000000000000000000000de0b6b3a7640000',
      };
      
      const simpleGas = calculateGasEstimate(simpleTx);
      const complexGas = calculateGasEstimate(complexTx);
      
      expect(complexGas).toBeGreaterThan(simpleGas);
    });
  });

  describe('Wallet Generation', () => {
    it('should generate valid wallet objects', () => {
      const wallet = generateWallet();
      
      expect(wallet).toHaveProperty('address');
      expect(wallet).toHaveProperty('privateKey');
      expect(wallet).toHaveProperty('publicKey');
      
      expect(validateEthereumAddress(wallet.address)).toBe(true);
      expect(wallet.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should generate different wallets each time', () => {
      const wallet1 = generateWallet();
      const wallet2 = generateWallet();
      
      expect(wallet1.address).not.toBe(wallet2.address);
      expect(wallet1.privateKey).not.toBe(wallet2.privateKey);
    });
  });

  describe('IPFS Utilities', () => {
    it('should validate IPFS CIDs', () => {
      const validCIDs = [
        'QmXwN9dYd4T8J2kF3mZpA8hE9xN5vL2qR4mN7bC6dF3gH1jK5mN',
        'QmYf7rEs2R6gQ5hP3xKvT8uJ2nM5pL4kF9dS7wE3rT6yU1iO3pQ',
      ];

      validCIDs.forEach((cid) => {
        expect(isValidIPFSCID(cid)).toBe(true);
      });
    });

    it('should reject invalid IPFS CIDs', () => {
      const invalidCIDs = [
        'invalid-cid',
        'QmXwN9dYd4T8J2kF3mZpA8hE9xN5vL2qR4mN7bC6dF3gH1jK5m', // Too short
        'QmXwN9dYd4T8J2kF3mZpA8hE9xN5vL2qR4mN7bC6dF3gH1jK5mNNNN', // Too long
        'XYZ1234567890abcdef1234567890abcdef1234567890',
      ];

      invalidCIDs.forEach((cid) => {
        expect(isValidIPFSCID(cid)).toBe(false);
      });
    });

    it('should encode and decode CIDs', () => {
      const originalData = 'Hello, IPFS!';
      const cid = encodeCID(originalData);
      const decodedData = decodeCID(cid);
      
      expect(typeof cid).toBe('string');
      expect(decodedData).toBe(originalData);
    });
  });

  describe('File Hashing', () => {
    it('should hash files correctly', async () => {
      const testFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' });
      const hash = await hashFile(testFile);
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
    });

    it('should produce consistent hashes for same content', async () => {
      const file1 = new File(['Hello, World!'], 'test1.txt', { type: 'text/plain' });
      const file2 = new File(['Hello, World!'], 'test2.txt', { type: 'text/plain' });
      
      const hash1 = await hashFile(file1);
      const hash2 = await hashFile(file2);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('PoP System Utilities', () => {
    it('should validate PoP scores', () => {
      expect(isValidPoPScore(0)).toBe(true);
      expect(isValidPoPScore(5000)).toBe(true);
      expect(isValidPoPScore(10000)).toBe(true);
      expect(isValidPoPScore(-100)).toBe(false);
    });

    it('should calculate productivity tiers correctly', () => {
      expect(calculateProductivityTier(0)).toBe('Bronze');
      expect(calculateProductivityTier(1000)).toBe('Bronze');
      expect(calculateProductivityTier(2500)).toBe('Silver');
      expect(calculateProductivityTier(5000)).toBe('Gold');
      expect(calculateProductivityTier(10000)).toBe('Diamond');
    });

    it('should estimate weekly rewards based on score', () => {
      const reward = estimateWeeklyReward(5000);
      expect(typeof reward).toBe('string');
      expect(parseFloat(reward)).toBeGreaterThan(0);
    });

    it('should calculate different rewards for different tiers', () => {
      const bronzeReward = estimateWeeklyReward(1000);
      const diamondReward = estimateWeeklyTier(10000);
      
      expect(parseFloat(diamondReward)).toBeGreaterThan(parseFloat(bronzeReward));
    });
  });

  describe('Transaction Utilities', () => {
    it('should generate transaction IDs', () => {
      const txId1 = generateTransactionId();
      const txId2 = generateTransactionId();
      
      expect(txId1).toMatch(/^0x[a-f0-9]{64}$/);
      expect(txId2).toMatch(/^0x[a-f0-9]{64}$/);
      expect(txId1).not.toBe(txId2);
    });

    it('should format timestamps', () => {
      const timestamp = 1609459200000; // 2021-01-01 UTC
      const formatted = formatTimestamp(timestamp);
      
      expect(formatted).toBe('2021-01-01 00:00:00 UTC');
    });
  });

  describe('Wei Conversion', () => {
    it('should convert to Wei correctly', () => {
      expect(convertToWei('1')).toBe('1000000000000000000');
      expect(convertToWei('0.5')).toBe('500000000000000000');
      expect(convertToWei('0.001')).toBe('1000000000000000');
    });

    it('should convert from Wei correctly', () => {
      expect(convertFromWei('1000000000000000000')).toBe('1');
      expect(convertFromWei('500000000000000000')).toBe('0.5');
      expect(convertFromWei('1000000000000000')).toBe('0.001');
    });

    it('should handle edge cases', () => {
      expect(convertToWei('0')).toBe('0');
      expect(convertFromWei('0')).toBe('0');
      expect(convertToWei('1000')).toBe('1000000000000000000000');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid inputs gracefully', () => {
      expect(() => validateEthereumAddress(null)).not.toThrow();
      expect(() => validateEthereumAddress(undefined)).not.toThrow();
      expect(() => formatTokenAmount('invalid')).not.toThrow();
      expect(() => generateWallet()).not.toThrow();
    });

    it('should return false for invalid inputs', () => {
      expect(validateEthereumAddress(null)).toBe(false);
      expect(validateEthereumAddress(undefined)).toBe(false);
      expect(isValidPoPScore(null)).toBe(false);
      expect(isValidIPFSCID(null)).toBe(false);
    });
  });
});