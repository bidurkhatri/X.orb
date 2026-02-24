// src/services/web3/defiService.ts
import { ethers } from 'ethers';

const UNISWAP_V3_CONTRACT_ABI = [
  "function swapExactInputSingle(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMinimum, uint24 fee) external returns (uint256 amountOut)",
  "function addLiquidity(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min) external returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  "function getQuoteForSwap(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee) external view returns (uint256 amountOut)",
  "function getUserStats(address user) external view returns (uint256 swapCount, uint256 totalVolume, uint256 averageTradeSize)"
];

const AAV3_CONTRACT_ABI = [
  "function supply(address asset, uint256 amount, address onBehalfOf) external",
  "function withdraw(address asset, uint256 amount, address to) external returns (uint256)",
  "function borrow(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) external",
  "function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) external returns (uint256)",
  "function getUserAccountData(address user) external view returns (uint256 totalCollateral, uint256 totalDebt, uint256 availableBorrows, uint256 currentLTV, uint256 healthFactor, bool isLiquidatable)",
  "function getUserPosition(address user) external view returns (uint256 stakedAmount, uint256 shares, uint256 pendingRewards, uint256 totalRewardsClaimed, uint256 lastUpdateTime, uint256 currentValue)"
];

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOutMinimum: string;
  fee: number; // 3000 = 0.3%, 500 = 0.05%
}

export interface LiquidityParams {
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  amount0Desired: string;
  amount1Desired: string;
  amount0Min: string;
  amount1Min: string;
}

export interface LendingPosition {
  totalCollateral: string;
  totalDebt: string;
  availableBorrows: string;
  currentLTV: string;
  healthFactor: string;
  isLiquidatable: boolean;
}

export class DeFiService {
  private provider: ethers.BrowserProvider;
  private signer: ethers.JsonRpcSigner | null = null;
  private uniswapContract: ethers.Contract;
  private aaveContract: ethers.Contract;

  constructor(provider: ethers.BrowserProvider) {
    this.provider = provider;
    this.uniswapContract = new ethers.Contract(
      process.env.REACT_APP_UNISWAP_V3_MANAGER!,
      UNISWAP_V3_CONTRACT_ABI,
      this.provider
    );
    this.aaveContract = new ethers.Contract(
      process.env.REACT_APP_AAVE_V3_MANAGER!,
      AAV3_CONTRACT_ABI,
      this.provider
    );
  }

  async connect(): Promise<string> {
    if (!window.ethereum) {
      throw new Error('MetaMask not found');
    }

    await this.provider.send('eth_requestAccounts', []);
    this.signer = await this.provider.getSigner();
    this.uniswapContract = this.uniswapContract.connect(this.signer);
    this.aaveContract = this.aaveContract.connect(this.signer);
    
    return await this.signer.getAddress();
  }

  // Uniswap V3 Operations
  async executeSwap(params: SwapParams): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      // Check token balances
      const tokenInContract = new ethers.Contract(
        params.tokenIn,
        ['function balanceOf(address) view returns (uint256)'],
        this.signer
      );

      const userAddress = await this.signer.getAddress();
      const userBalance = await tokenInContract.balanceOf(userAddress);
      const amountInWei = ethers.parseEther(params.amountIn);

      if (userBalance < amountInWei) {
        throw new Error('Insufficient token balance');
      }

      // Approve token if needed
      const allowance = await tokenInContract.allowance(userAddress, this.uniswapContract.target);
      if (allowance < amountInWei) {
        const approveTx = await tokenInContract.approve(
          this.uniswapContract.target,
          ethers.MaxUint256
        );
        await approveTx.wait();
      }

      const tx = await this.uniswapContract.swapExactInputSingle(
        params.tokenIn,
        params.tokenOut,
        amountInWei,
        ethers.parseEther(params.amountOutMinimum),
        params.fee
      );

      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Swap failed:', error);
      throw new Error('Failed to execute swap');
    }
  }

  async addLiquidity(params: LiquidityParams): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const userAddress = await this.signer.getAddress();
      const amount0Wei = ethers.parseEther(params.amount0Desired);
      const amount1Wei = ethers.parseEther(params.amount1Desired);

      // Check token balances and approvals
      const token0Contract = new ethers.Contract(
        params.token0,
        ['function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)'],
        this.signer
      );
      const token1Contract = new ethers.Contract(
        params.token1,
        ['function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)'],
        this.signer
      );

      const balance0 = await token0Contract.balanceOf(userAddress);
      const balance1 = await token1Contract.balanceOf(userAddress);

      if (balance0 < amount0Wei) {
        throw new Error('Insufficient token0 balance');
      }
      if (balance1 < amount1Wei) {
        throw new Error('Insufficient token1 balance');
      }

      // Approve tokens if needed
      const allowance0 = await token0Contract.allowance(userAddress, this.uniswapContract.target);
      const allowance1 = await token1Contract.allowance(userAddress, this.uniswapContract.target);

      if (allowance0 < amount0Wei) {
        const approveTx0 = await token0Contract.approve(
          this.uniswapContract.target,
          ethers.MaxUint256
        );
        await approveTx0.wait();
      }

      if (allowance1 < amount1Wei) {
        const approveTx1 = await token1Contract.approve(
          this.uniswapContract.target,
          ethers.MaxUint256
        );
        await approveTx1.wait();
      }

      const tx = await this.uniswapContract.addLiquidity(
        params.token0,
        params.token1,
        params.fee,
        params.tickLower,
        params.tickUpper,
        amount0Wei,
        amount1Wei,
        ethers.parseEther(params.amount0Min),
        ethers.parseEther(params.amount1Min)
      );

      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Add liquidity failed:', error);
      throw new Error('Failed to add liquidity');
    }
  }

  async getSwapQuote(tokenIn: string, tokenOut: string, amountIn: string, fee: number = 3000): Promise<string> {
    try {
      const amountInWei = ethers.parseEther(amountIn);
      const quote = await this.uniswapContract.getQuoteForSwap(
        tokenIn,
        tokenOut,
        amountInWei,
        fee
      );
      return ethers.formatEther(quote);
    } catch (error) {
      console.error('Failed to get quote:', error);
      return '0';
    }
  }

  async getUserUniswapStats(): Promise<{ swapCount: number; totalVolume: string; averageTradeSize: string }> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const userAddress = await this.signer.getAddress();
      const [swapCount, totalVolume, averageTradeSize] = await this.uniswapContract.getUserStats(userAddress);
      
      return {
        swapCount: Number(swapCount),
        totalVolume: ethers.formatEther(totalVolume),
        averageTradeSize: ethers.formatEther(averageTradeSize)
      };
    } catch (error) {
      console.error('Failed to get user stats:', error);
      return { swapCount: 0, totalVolume: '0', averageTradeSize: '0' };
    }
  }

  // Aave V3 Operations
  async supplyToAave(asset: string, amount: string, onBehalfOf: string = ''): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const userAddress = await this.signer.getAddress();
      const targetAddress = onBehalfOf || userAddress;
      const amountWei = ethers.parseEther(amount);

      // Check balance and approval
      const tokenContract = new ethers.Contract(
        asset,
        ['function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)'],
        this.signer
      );

      const balance = await tokenContract.balanceOf(userAddress);
      if (balance < amountWei) {
        throw new Error('Insufficient token balance');
      }

      const allowance = await tokenContract.allowance(userAddress, this.aaveContract.target);
      if (allowance < amountWei) {
        const approveTx = await tokenContract.approve(
          this.aaveContract.target,
          ethers.MaxUint256
        );
        await approveTx.wait();
      }

      const tx = await this.aaveContract.supply(asset, amountWei, targetAddress);
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Supply failed:', error);
      throw new Error('Failed to supply to Aave');
    }
  }

  async withdrawFromAave(asset: string, amount: string, to: string = ''): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const userAddress = await this.signer.getAddress();
      const targetAddress = to || userAddress;
      const amountWei = ethers.parseEther(amount);

      const tx = await this.aaveContract.withdraw(asset, amountWei, targetAddress);
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Withdraw failed:', error);
      throw new Error('Failed to withdraw from Aave');
    }
  }

  async borrowFromAave(asset: string, amount: string, interestRateMode: number = 2, onBehalfOf: string = ''): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const userAddress = await this.signer.getAddress();
      const targetAddress = onBehalfOf || userAddress;
      const amountWei = ethers.parseEther(amount);

      // Check health factor before borrowing
      const position = await this.getAavePosition();
      if (position.isLiquidatable) {
        throw new Error('Account is liquidatable');
      }

      const tx = await this.aaveContract.borrow(asset, amountWei, interestRateMode, 0, targetAddress);
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Borrow failed:', error);
      throw new Error('Failed to borrow from Aave');
    }
  }

  async repayAaveDebt(asset: string, amount: string, interestRateMode: number = 2, onBehalfOf: string = ''): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const userAddress = await this.signer.getAddress();
      const targetAddress = onBehalfOf || userAddress;
      const amountWei = ethers.parseEther(amount);

      // Check balance and approval
      const tokenContract = new ethers.Contract(
        asset,
        ['function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)'],
        this.signer
      );

      const balance = await tokenContract.balanceOf(userAddress);
      if (balance < amountWei) {
        throw new Error('Insufficient token balance');
      }

      const allowance = await tokenContract.allowance(userAddress, this.aaveContract.target);
      if (allowance < amountWei) {
        const approveTx = await tokenContract.approve(
          this.aaveContract.target,
          ethers.MaxUint256
        );
        await approveTx.wait();
      }

      const tx = await this.aaveContract.repay(asset, amountWei, interestRateMode, targetAddress);
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Repay failed:', error);
      throw new Error('Failed to repay Aave debt');
    }
  }

  async getAavePosition(): Promise<LendingPosition> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const userAddress = await this.signer.getAddress();
      const [totalCollateral, totalDebt, availableBorrows, currentLTV, healthFactor, isLiquidatable] = 
        await this.aaveContract.getUserAccountData(userAddress);

      return {
        totalCollateral: ethers.formatEther(totalCollateral),
        totalDebt: ethers.formatEther(totalDebt),
        availableBorrows: ethers.formatEther(availableBorrows),
        currentLTV: (Number(currentLTV) / 100).toString() + '%',
        healthFactor: (Number(healthFactor) / 1e18).toString(),
        isLiquidatable
      };
    } catch (error) {
      console.error('Failed to get Aave position:', error);
      return {
        totalCollateral: '0',
        totalDebt: '0',
        availableBorrows: '0',
        currentLTV: '0%',
        healthFactor: '0',
        isLiquidatable: false
      };
    }
  }

  async getAvailableAssets(): Promise<Array<{ address: string; symbol: string; name: string; canBeCollateral: boolean; canBeBorrowed: boolean }>> {
    // This would typically fetch from Aave or a token registry
    return [
      {
        address: '0xA0b86a33E6411b8b7ce9c3a8b6C0C3C5a7F9d8c2',
        symbol: 'SYL',
        name: 'SylOS Token',
        canBeCollateral: true,
        canBeBorrowed: true
      }
    ];
  }

  // Utility functions
  calculatePriceImpact(token0: string, token1: string, amountIn: string): Promise<number> {
    // This would calculate price impact based on pool reserves
    return Promise.resolve(0);
  }

  getSlippageTolerance(): number {
    return 0.5; // 0.5% default slippage
  }

  setSlippageTolerance(tolerance: number): void {
    // Store in local storage or context
  }
}