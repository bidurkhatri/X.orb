import { renderHook, act } from '@testing-library/react';
import { useWeb3 } from '../src/hooks/useWeb3';
import { useIPFS } from '../src/hooks/useIPFS';
import { usePoPTracker } from '../src/hooks/usePoPTracker';
import { useWallet } from '../src/hooks/useWallet';
import { useTokenManagement } from '../src/hooks/useTokenManagement';

describe('SylOS Hooks', () => {
  describe('useWeb3', () => {
    beforeEach(() => {
      // Mock Web3 provider
      global.window.ethereum = {
        request: jest.fn().mockResolvedValue('0x1234567890abcdef1234567890abcdef12345678'),
        on: jest.fn(),
        removeListener: jest.fn(),
        selectedAddress: '0x1234567890abcdef1234567890abcdef12345678',
        networkVersion: '137',
        isConnected: jest.fn().mockReturnValue(true),
      };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should initialize with default state', () => {
      const { result } = renderHook(() => useWeb3());
      
      expect(result.current.account).toBeNull();
      expect(result.current.network).toBeNull();
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should connect to wallet successfully', async () => {
      const { result } = renderHook(() => useWeb3());
      
      await act(async () => {
        await result.current.connect();
      });
      
      expect(result.current.account).toBe('0x1234567890abcdef1234567890abcdef12345678');
      expect(result.current.network).toBe('137');
      expect(result.current.isConnected).toBe(true);
    });

    it('should handle connection error', async () => {
      global.window.ethereum.request = jest.fn().mockRejectedValue(new Error('User rejected connection'));
      
      const { result } = renderHook(() => useWeb3());
      
      await act(async () => {
        try {
          await result.current.connect();
        } catch (error) {
          expect(error.message).toBe('User rejected connection');
        }
      });
      
      expect(result.current.error).toBe('User rejected connection');
    });

    it('should disconnect wallet', async () => {
      const { result } = renderHook(() => useWeb3());
      
      // First connect
      await act(async () => {
        await result.current.connect();
      });
      
      expect(result.current.isConnected).toBe(true);
      
      // Then disconnect
      await act(async () => {
        await result.current.disconnect();
      });
      
      expect(result.current.isConnected).toBe(false);
      expect(result.current.account).toBeNull();
    });

    it('should handle network changes', () => {
      const { result } = renderHook(() => useWeb3());
      
      // Simulate network change event
      act(() => {
        global.window.ethereum.on.mock.calls[0][1]('0x89'); // Polygon network
      });
      
      expect(result.current.network).toBe('137'); // Mainnet
    });
  });

  describe('useIPFS', () => {
    const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });
    const mockCID = 'QmXwN9dYd4T8J2kF3mZpA8hE9xN5vL2qR4mN7bC6dF3gH1jK5mN';
    
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useIPFS());
      
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isUploading).toBe(false);
      expect(result.current.uploadProgress).toBe(0);
      expect(result.current.files).toEqual([]);
    });

    it('should connect to IPFS node', async () => {
      const { result } = renderHook(() => useIPFS());
      
      await act(async () => {
        await result.current.connect('localhost', 5001);
      });
      
      expect(result.current.isConnected).toBe(true);
    });

    it('should upload file successfully', async () => {
      const { result } = renderHook(() => useIPFS());
      
      // Mock successful upload
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ Hash: mockCID }),
      });
      
      await act(async () => {
        const cid = await result.current.uploadFile(mockFile);
        expect(cid).toBe(mockCID);
      });
      
      expect(result.current.uploadProgress).toBe(100);
      expect(result.current.files).toContain(mockCID);
    });

    it('should handle upload error', async () => {
      const { result } = renderHook(() => useIPFS());
      
      // Mock failed upload
      global.fetch = jest.fn().mockRejectedValue(new Error('Upload failed'));
      
      await act(async () => {
        try {
          await result.current.uploadFile(mockFile);
        } catch (error) {
          expect(error.message).toBe('Upload failed');
        }
      });
      
      expect(result.current.error).toBe('Upload failed');
    });

    it('should retrieve file content', async () => {
      const { result } = renderHook(() => useIPFS());
      
      const testContent = 'Hello, IPFS!';
      const mockResponse = new Response(testContent);
      global.fetch = jest.fn().mockResolvedValue(mockResponse);
      
      await act(async () => {
        const content = await result.current.getFile(mockCID);
        expect(content).toBe(testContent);
      });
    });

    it('should handle retrieval error', async () => {
      const { result } = renderHook(() => useIPFS());
      
      global.fetch = jest.fn().mockRejectedValue(new Error('File not found'));
      
      await act(async () => {
        try {
          await result.current.getFile('invalid-cid');
        } catch (error) {
          expect(error.message).toBe('File not found');
        }
      });
    });
  });

  describe('usePoPTracker', () => {
    it('should initialize with default productivity state', () => {
      const { result } = renderHook(() => usePoPTracker());
      
      expect(result.current.score).toBe(0);
      expect(result.current.tier).toBe('Bronze');
      expect(result.current.weeklyReward).toBe('0');
      expect(result.current.tasks).toEqual([]);
    });

    it('should update productivity score', async () => {
      const { result } = renderHook(() => usePoPTracker());
      
      await act(async () => {
        await result.current.updateScore(100);
      });
      
      expect(result.current.score).toBe(100);
    });

    it('should add new task', async () => {
      const { result } = renderHook(() => usePoPTracker());
      
      const newTask = {
        id: 1,
        title: 'Test Task',
        description: 'Test task description',
        points: 50,
        deadline: new Date(),
      };
      
      await act(async () => {
        result.current.addTask(newTask);
      });
      
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0].title).toBe('Test Task');
    });

    it('should complete task and award points', async () => {
      const { result } = renderHook(() => usePoPTracker());
      
      // Add a task first
      const newTask = {
        id: 1,
        title: 'Test Task',
        description: 'Test task description',
        points: 50,
        deadline: new Date(),
      };
      
      await act(async () => {
        result.current.addTask(newTask);
      });
      
      // Complete the task
      await act(async () => {
        await result.current.completeTask(1);
      });
      
      expect(result.current.tasks[0].completed).toBe(true);
      expect(result.current.score).toBe(50);
    });

    it('should calculate weekly reward based on tier', async () => {
      const { result } = renderHook(() => usePoPTracker());
      
      // Set score to reach Diamond tier
      await act(async () => {
        await result.current.updateScore(10000);
      });
      
      expect(result.current.tier).toBe('Diamond');
      expect(parseFloat(result.current.weeklyReward)).toBeGreaterThan(0);
    });
  });

  describe('useWallet', () => {
    beforeEach(() => {
      global.window.ethereum = {
        request: jest.fn().mockResolvedValue('0x1234567890abcdef1234567890abcdef12345678'),
        on: jest.fn(),
        removeListener: jest.fn(),
        selectedAddress: '0x1234567890abcdef1234567890abcdef12345678',
      };
    });

    it('should initialize with default wallet state', () => {
      const { result } = renderHook(() => useWallet());
      
      expect(result.current.address).toBeNull();
      expect(result.current.balance).toBe('0');
      expect(result.current.tokens).toEqual([]);
    });

    it('should connect wallet and load balance', async () => {
      // Mock Web3 balance
      global.web3 = {
        eth: {
          getBalance: jest.fn().mockResolvedValue('1000000000000000000'), // 1 ETH
          getTransactionCount: jest.fn().mockResolvedValue(0),
        },
      };
      
      const { result } = renderHook(() => useWallet());
      
      await act(async () => {
        await result.current.connect();
      });
      
      expect(result.current.address).toBe('0x1234567890abcdef1234567890abcdef12345678');
      expect(parseFloat(result.current.balance)).toBeGreaterThan(0);
    });

    it('should send transaction', async () => {
      // Mock Web3 transaction
      global.web3 = {
        eth: {
          sendTransaction: jest.fn().mockResolvedValue({
            transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          }),
        },
      };
      
      const { result } = renderHook(() => useWallet());
      
      // First connect
      await act(async () => {
        await result.current.connect();
      });
      
      const txData = {
        to: '0xabcdef1234567890abcdef1234567890abcdef1234',
        value: '1000000000000000000',
        data: '0x',
      };
      
      await act(async () => {
        const txHash = await result.current.sendTransaction(txData);
        expect(txHash).toBe('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      });
    });
  });

  describe('useTokenManagement', () => {
    const mockTokenAddress = '0x1234567890abcdef1234567890abcdef12345678';
    
    beforeEach(() => {
      global.window.ethereum = {
        request: jest.fn().mockResolvedValue('0x1234567890abcdef1234567890abcdef12345678'),
        on: jest.fn(),
        removeListener: jest.fn(),
        selectedAddress: '0x1234567890abcdef1234567890abcdef12345678',
      };
    });

    it('should initialize with default token state', () => {
      const { result } = renderHook(() => useTokenManagement());
      
      expect(result.current.tokens).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('should load token balance', async () => {
      // Mock contract interaction
      global.web3 = {
        eth: {
          Contract: jest.fn(() => ({
            methods: {
              balanceOf: jest.fn().mockReturnValue({
                call: jest.fn().mockResolvedValue('1000000000000000000'),
              }),
              symbol: jest.fn().mockReturnValue({
                call: jest.fn().mockResolvedValue('SYLOS'),
              }),
              decimals: jest.fn().mockReturnValue({
                call: jest.fn().mockResolvedValue(18),
              }),
            },
          })),
        },
      };
      
      const { result } = renderHook(() => useTokenManagement());
      
      await act(async () => {
        await result.current.loadTokenBalance(mockTokenAddress);
      });
      
      expect(result.current.tokens).toHaveLength(1);
      expect(result.current.tokens[0].symbol).toBe('SYLOS');
      expect(result.current.tokens[0].balance).toBe('1');
    });

    it('should transfer token', async () => {
      global.web3 = {
        eth: {
          sendTransaction: jest.fn().mockResolvedValue({
            transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          }),
        },
      };
      
      const { result } = renderHook(() => useTokenManagement());
      
      await act(async () => {
        const txHash = await result.current.transferToken(
          mockTokenAddress,
          '0xabcdef1234567890abcdef1234567890abcdef1234',
          '1'
        );
        expect(txHash).toBe('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      });
    });
  });
});