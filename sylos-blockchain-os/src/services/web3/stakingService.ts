// src/services/web3/stakingService.ts
import { ethers } from 'ethers';

const STAKING_CONTRACT_ABI = [
  "function stake(uint256 amount) external payable",
  "function unstake(uint256 shares) external",
  "function claimRewards() external",
  "function compoundRewards() external",
  "function getUserPosition(address user) external view returns (uint256 stakedAmount, uint256 shares, uint256 pendingRewards, uint256 totalRewardsClaimed, uint256 lastUpdateTime, uint256 currentValue)",
  "function getCurrentAPY() external view returns (uint256)",
  "function getSharePrice() external view returns (uint256)",
  "function isStaking(address user) external view returns (bool)",
  "function totalStaked() external view returns (uint256)",
  "function totalShares() external view returns (uint256)",
  "function totalRewards() external view returns (uint256)",
  "function performanceFee() external view returns (uint256)",
  "function withdrawalFee() external view returns (uint256)",
  "event Staked(address indexed user, uint256 amount, uint256 sharesMinted)",
  "event Unstaked(address indexed user, uint256 amount, uint256 sharesBurned, uint256 rewards)",
  "event RewardsClaimed(address indexed user, uint256 amount, uint256 rewards)"
];

export interface StakingPosition {
  stakedAmount: string;
  shares: string;
  pendingRewards: string;
  totalRewardsClaimed: string;
  currentValue: string;
  apy: string;
  sharePrice: string;
}

export interface StakingStats {
  totalStaked: string;
  totalShares: string;
  totalRewards: string;
  userCount: number;
  averageStake: string;
  apy: string;
}

export class StakingService {
  private provider: ethers.BrowserProvider;
  private signer: ethers.JsonRpcSigner | null = null;
  private contract: ethers.Contract;

  constructor(provider: ethers.BrowserProvider) {
    this.provider = provider;
    this.contract = new ethers.Contract(
      process.env.REACT_APP_STAKING_CONTRACT!,
      STAKING_CONTRACT_ABI,
      this.provider
    );
  }

  async connect(): Promise<string> {
    if (!window.ethereum) {
      throw new Error('MetaMask not found');
    }

    await this.provider.send('eth_requestAccounts', []);
    this.signer = await this.provider.getSigner();
    this.contract = this.contract.connect(this.signer);
    
    return await this.signer.getAddress();
  }

  async stake(amount: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const userAddress = await this.signer.getAddress();
      const amountWei = ethers.parseEther(amount);

      // Check minimum stake amount
      const minStake = await this.contract.minStakeAmount();
      if (amountWei < minStake) {
        throw new Error('Amount below minimum stake');
      }

      // Check maximum stake amount
      const maxStake = await this.contract.maxStakeAmount();
      if (amountWei > maxStake) {
        throw new Error('Amount above maximum stake');
      }

      const tx = await this.contract.stake(amountWei, { value: amountWei });
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Staking failed:', error);
      throw new Error('Failed to stake tokens');
    }
  }

  async unstake(shares: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const position = await this.getUserPosition();
      
      if (parseFloat(shares) > parseFloat(position.shares)) {
        throw new Error('Insufficient shares');
      }

      const sharesWei = ethers.parseEther(shares);
      const tx = await this.contract.unstake(sharesWei);
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Unstaking failed:', error);
      throw new Error('Failed to unstake tokens');
    }
  }

  async claimRewards(): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const position = await this.getUserPosition();
      if (parseFloat(position.pendingRewards) <= 0) {
        throw new Error('No pending rewards');
      }

      const tx = await this.contract.claimRewards();
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Claiming rewards failed:', error);
      throw new Error('Failed to claim rewards');
    }
  }

  async compoundRewards(): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const position = await this.getUserPosition();
      if (parseFloat(position.pendingRewards) <= 0) {
        throw new Error('No pending rewards to compound');
      }

      const tx = await this.contract.compoundRewards();
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Compounding rewards failed:', error);
      throw new Error('Failed to compound rewards');
    }
  }

  async getUserPosition(): Promise<StakingPosition> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const userAddress = await this.signer.getAddress();
      const [
        stakedAmount,
        shares,
        pendingRewards,
        totalRewardsClaimed,
        lastUpdateTime,
        currentValue
      ] = await this.contract.getUserPosition(userAddress);

      const apy = await this.getCurrentAPY();
      const sharePrice = await this.getSharePrice();

      return {
        stakedAmount: ethers.formatEther(stakedAmount),
        shares: ethers.formatEther(shares),
        pendingRewards: ethers.formatEther(pendingRewards),
        totalRewardsClaimed: ethers.formatEther(totalRewardsClaimed),
        currentValue: ethers.formatEther(currentValue),
        apy: (Number(apy) / 1e18 * 100).toFixed(2) + '%',
        sharePrice: ethers.formatEther(sharePrice)
      };
    } catch (error) {
      console.error('Failed to get user position:', error);
      return {
        stakedAmount: '0',
        shares: '0',
        pendingRewards: '0',
        totalRewardsClaimed: '0',
        currentValue: '0',
        apy: '0%',
        sharePrice: '1'
      };
    }
  }

  async isStaking(): Promise<boolean> {
    if (!this.signer) {
      return false;
    }

    try {
      const userAddress = await this.signer.getAddress();
      return await this.contract.isStaking(userAddress);
    } catch (error) {
      console.error('Failed to check staking status:', error);
      return false;
    }
  }

  async getCurrentAPY(): Promise<string> {
    try {
      const apy = await this.contract.getCurrentAPY();
      return (Number(apy) / 1e18 * 100).toFixed(2) + '%';
    } catch (error) {
      console.error('Failed to get APY:', error);
      return '0%';
    }
  }

  async getSharePrice(): Promise<string> {
    try {
      const price = await this.contract.getSharePrice();
      return ethers.formatEther(price);
    } catch (error) {
      console.error('Failed to get share price:', error);
      return '1';
    }
  }

  async getGlobalStats(): Promise<StakingStats> {
    try {
      const [totalStaked, totalShares, totalRewards] = await Promise.all([
        this.contract.totalStaked(),
        this.contract.totalShares(),
        this.contract.totalRewards()
      ]);

      const apy = await this.getCurrentAPY();
      
      return {
        totalStaked: ethers.formatEther(totalStaked),
        totalShares: ethers.formatEther(totalShares),
        totalRewards: ethers.formatEther(totalRewards),
        userCount: 0, // Would need additional contract method
        averageStake: '0', // Would need additional calculation
        apy
      };
    } catch (error) {
      console.error('Failed to get global stats:', error);
      return {
        totalStaked: '0',
        totalShares: '0',
        totalRewards: '0',
        userCount: 0,
        averageStake: '0',
        apy: '0%'
      };
    }
  }

  async getStakingHistory(): Promise<Array<{
    type: 'stake' | 'unstake' | 'claim' | 'compound';
    amount: string;
    shares?: string;
    rewards?: string;
    timestamp: number;
    hash: string;
  }>> {
    if (!this.signer) {
      return [];
    }

    try {
      const userAddress = await this.signer.getAddress();
      const events: any[] = [];

      // Get stake events
      const stakeFilter = this.contract.filters.Staked(null, null, null);
      const stakeEvents = await this.contract.queryFilter(stakeFilter, 0, 'latest');
      
      for (const event of stakeEvents) {
        if (event.args.user.toLowerCase() === userAddress.toLowerCase()) {
          events.push({
            type: 'stake' as const,
            amount: ethers.formatEther(event.args.amount),
            shares: ethers.formatEther(event.args.sharesMinted),
            timestamp: (await this.provider.getBlock(event.blockNumber))?.timestamp || 0,
            hash: event.transactionHash
          });
        }
      }

      // Get unstake events
      const unstakeFilter = this.contract.filters.Unstaked(null, null, null);
      const unstakeEvents = await this.contract.queryFilter(unstakeFilter, 0, 'latest');
      
      for (const event of unstakeEvents) {
        if (event.args.user.toLowerCase() === userAddress.toLowerCase()) {
          events.push({
            type: 'unstake' as const,
            amount: ethers.formatEther(event.args.amount),
            shares: ethers.formatEther(event.args.sharesBurned),
            rewards: ethers.formatEther(event.args.rewards),
            timestamp: (await this.provider.getBlock(event.blockNumber))?.timestamp || 0,
            hash: event.transactionHash
          });
        }
      }

      // Get claim events
      const claimFilter = this.contract.filters.RewardsClaimed(null, null, null);
      const claimEvents = await this.contract.queryFilter(claimFilter, 0, 'latest');
      
      for (const event of claimEvents) {
        if (event.args.user.toLowerCase() === userAddress.toLowerCase()) {
          events.push({
            type: 'claim' as const,
            amount: ethers.formatEther(event.args.amount),
            rewards: ethers.formatEther(event.args.rewards),
            timestamp: (await this.provider.getBlock(event.blockNumber))?.timestamp || 0,
            hash: event.transactionHash
          });
        }
      }

      return events.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Failed to get staking history:', error);
      return [];
    }
  }

  async getRewardsBreakdown(): Promise<{
    pending: string;
    totalClaimed: string;
    totalCompounded: string;
    projectedDaily: string;
    projectedWeekly: string;
    projectedMonthly: string;
  }> {
    try {
      const position = await this.getUserPosition();
      const globalStats = await this.getGlobalStats();
      
      const apy = parseFloat(position.apy);
      const daily = apy / 365;
      const weekly = apy / 52;
      const monthly = apy / 12;
      
      return {
        pending: position.pendingRewards,
        totalClaimed: position.totalRewardsClaimed,
        totalCompounded: '0', // Would need additional tracking
        projectedDaily: (parseFloat(position.currentValue) * daily / 100).toFixed(6),
        projectedWeekly: (parseFloat(position.currentValue) * weekly / 100).toFixed(6),
        projectedMonthly: (parseFloat(position.currentValue) * monthly / 100).toFixed(6)
      };
    } catch (error) {
      console.error('Failed to get rewards breakdown:', error);
      return {
        pending: '0',
        totalClaimed: '0',
        totalCompounded: '0',
        projectedDaily: '0',
        projectedWeekly: '0',
        projectedMonthly: '0'
      };
    }
  }

  async calculateOptimalUnstake(): Promise<{
    maxWithdrawable: string;
    fullAmount: { amount: string; shares: string };
    partialAmounts: Array<{ percentage: number; amount: string; shares: string; rewards: string }>;
  }> {
    try {
      const position = await this.getUserPosition();
      const sharePrice = await this.getSharePrice();
      const performanceFee = await this.contract.performanceFee();
      const withdrawalFee = await this.contract.withdrawalFee();

      const totalShares = parseFloat(position.shares);
      const sharePriceFloat = parseFloat(sharePrice);

      // Calculate different withdrawal options
      const partialAmounts = [10, 25, 50, 75].map(percentage => {
        const sharesToWithdraw = totalShares * (percentage / 100);
        const amount = sharesToWithdraw * sharePriceFloat;
        const rewards = parseFloat(position.pendingRewards) * (percentage / 100);
        const fees = (amount * Number(withdrawalFee)) / 10000;
        const netAmount = amount - fees;

        return {
          percentage,
          amount: netAmount.toFixed(6),
          shares: sharesToWithdraw.toFixed(6),
          rewards: rewards.toFixed(6)
        };
      });

      const fullShares = totalShares;
      const fullAmount = {
        amount: (fullShares * sharePriceFloat).toFixed(6),
        shares: fullShares.toFixed(6)
      };

      return {
        maxWithdrawable: fullAmount.amount,
        fullAmount,
        partialAmounts
      };
    } catch (error) {
      console.error('Failed to calculate optimal unstake:', error);
      return {
        maxWithdrawable: '0',
        fullAmount: { amount: '0', shares: '0' },
        partialAmounts: []
      };
    }
  }

  // Utility functions
  async estimateStakeReturns(amount: string, timeInDays: number = 365): Promise<{
    initialAmount: string;
    finalAmount: string;
    totalRewards: string;
    apy: string;
    dailyRewards: string;
  }> {
    try {
      const currentAPY = await this.getCurrentAPY();
      const apy = parseFloat(currentAPY) / 100;
      const dailyRate = apy / 365;
      
      const amountFloat = parseFloat(amount);
      const finalAmount = amountFloat * Math.pow(1 + dailyRate, timeInDays);
      const totalRewards = finalAmount - amountFloat;
      const dailyRewards = amountFloat * dailyRate;

      return {
        initialAmount: amount,
        finalAmount: finalAmount.toFixed(6),
        totalRewards: totalRewards.toFixed(6),
        currentAPY: currentAPY,
        dailyRewards: dailyRewards.toFixed(6)
      };
    } catch (error) {
      console.error('Failed to estimate returns:', error);
      return {
        initialAmount: amount,
        finalAmount: amount,
        totalRewards: '0',
        apy: '0%',
        dailyRewards: '0'
      };
    }
  }

  async validateStakeParams(amount: string): Promise<{ valid: boolean; error?: string; warning?: string }> {
    try {
      if (parseFloat(amount) <= 0) {
        return { valid: false, error: 'Amount must be greater than 0' };
      }

      const [minStake, maxStake, totalStaked] = await Promise.all([
        this.contract.minStakeAmount(),
        this.contract.maxStakeAmount(),
        this.contract.totalStaked()
      ]);

      const amountWei = ethers.parseEther(amount);
      
      if (amountWei < minStake) {
        return { valid: false, error: `Minimum stake amount is ${ethers.formatEther(minStake)}` };
      }

      if (amountWei > maxStake) {
        return { valid: false, error: `Maximum stake amount is ${ethers.formatEther(maxStake)}` };
      }

      // Check for large amount warnings
      const totalStakedFloat = parseFloat(ethers.formatEther(totalStaked));
      const amountFloat = parseFloat(amount);
      
      if (amountFloat > totalStakedFloat * 0.1) { // > 10% of total staked
        return { 
          valid: true, 
          warning: 'Large stake amount may impact the protocol stability' 
        };
      }

      return { valid: true };
    } catch (error) {
      console.error('Failed to validate stake params:', error);
      return { valid: false, error: 'Validation failed' };
    }
  }
}