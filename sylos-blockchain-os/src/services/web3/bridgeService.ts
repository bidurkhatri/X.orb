import { ethers } from 'ethers';

// Chainlink CCIP Router ABI Implementation
const CCIP_ROUTER_ABI = [
  "function ccipSend(uint64 destinationChainSelector, tuple(bytes receiver, bytes data, tuple(address token, uint256 amount)[] tokenAmounts, address feeToken, bytes extraArgs) message) external payable returns (bytes32 messageId)",
  "function getFee(uint64 destinationChainSelector, tuple(bytes receiver, bytes data, tuple(address token, uint256 amount)[] tokenAmounts, address feeToken, bytes extraArgs) message) external view returns (uint256 fee)",
  "function isChainSupported(uint64 chainSelector) external view returns (bool supported)"
];

// Polygon Amoy CCIP Router Target
const ROUTER_ADDRESS = '0x9c3298d7088f11B38CB81cFC1BAcA5cE41f3bbFf';

export interface BridgeRequest {
  id: string; // CCIP messageId
  token: string;
  amount: string;
  fromChainSelector: string;
  toChainSelector: string;
  toAddress: string;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
}

export class CCIPBridgeService {
  private provider: ethers.BrowserProvider;
  private signer: ethers.JsonRpcSigner | null = null;
  private routerContract: ethers.Contract;

  constructor(provider: ethers.BrowserProvider) {
    this.provider = provider;
    this.routerContract = new ethers.Contract(
      ROUTER_ADDRESS,
      CCIP_ROUTER_ABI,
      this.provider
    );
  }

  async connect(): Promise<string> {
    if (!window.ethereum) throw new Error('Web3 Provider not found');
    await this.provider.send('eth_requestAccounts', []);
    this.signer = await this.provider.getSigner();
    this.routerContract = this.routerContract.connect(this.signer);
    return await this.signer.getAddress();
  }

  private buildCCIPMessage(
    toAddress: string,
    tokenAddress: string,
    amountWei: bigint,
    data: string = '0x'
  ) {
    const receiver = ethers.AbiCoder.defaultAbiCoder().encode(['address'], [toAddress]);

    // Construct the EVM2AnyMessage Struct for CCIP Route
    return {
      receiver: receiver,
      data: data,
      tokenAmounts: [
        {
          token: tokenAddress,
          amount: amountWei
        }
      ],
      feeToken: ethers.ZeroAddress, // Pay in native gas
      extraArgs: '0x' // Empty extra args for base transfers
    };
  }

  async bridgeTokensViaCCIP(
    tokenAddress: string,
    amount: string,
    destinationChainSelector: string,
    toAddress: string,
    data: string = '0x'
  ): Promise<string> {
    if (!this.signer) throw new Error('Wallet not connected');

    try {
      const amountWei = ethers.parseEther(amount);
      const message = this.buildCCIPMessage(toAddress, tokenAddress, amountWei, data);

      // Estimate CCIP Fee via Oracle
      const fee = await this.routerContract.getFee(BigInt(destinationChainSelector), message);

      // Execute Cross-Chain Message & Token Transfer
      const tx = await this.routerContract.ccipSend(
        BigInt(destinationChainSelector),
        message,
        { value: fee }
      );

      const receipt = await tx.wait();

      // The MessageId is emitted in the logs, but for simplicity we return the TX Hash directly
      return receipt?.hash || '';
    } catch (error) {
      console.error('CCIP Routing failed:', error);
      throw new Error('Failed to route tokens cross-chain via Chainlink CCIP');
    }
  }

  async getSupportedChains(): Promise<Array<{ id: string; name: string; symbol: string }>> {
    // Official CCIP Selectors
    const chains = [
      { id: '16015286601757825753', name: 'Ethereum Sepolia', symbol: 'ETH' },
      { id: '16281739943535281365', name: 'Polygon Amoy', symbol: 'MATIC' },
      { id: '3478487238524512106', name: 'Arbitrum Sepolia', symbol: 'ETH' },
      { id: '5224473277236331295', name: 'Optimism Sepolia', symbol: 'ETH' }
    ];

    try {
      // Filter dynamically via CCIP Router
      const supported = await Promise.all(
        chains.map(async (chain) => ({
          ...chain,
          supported: await this.routerContract.isChainSupported(BigInt(chain.id))
        }))
      );
      return supported.filter(chain => chain.supported);
    } catch (error) {
      console.error('CCIP configuration read failed:', error);
      return chains; // Fallback to presets
    }
  }

  async getBridgeHistory(userAddress: string): Promise<BridgeRequest[]> {
    // CCIP history is typically tracked off-chain via Chainlink CCIP Explorer APIs
    // For local mockup purposes, we return an empty array or cached local storage
    return [];
  }

  async estimateBridgeFee(amount: string, destinationChainSelector: string, tokenAddress: string, toAddress: string): Promise<string> {
    try {
      const amountWei = ethers.parseEther(amount);
      const message = this.buildCCIPMessage(toAddress, tokenAddress, amountWei);
      const fee = await this.routerContract.getFee(BigInt(destinationChainSelector), message);
      return ethers.formatEther(fee);
    } catch (error) {
      console.error('Fee estimation failed:', error);
      return '0';
    }
  }
}