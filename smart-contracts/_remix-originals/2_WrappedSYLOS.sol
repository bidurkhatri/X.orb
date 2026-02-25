// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Wrapper.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title WrappedSYLOS
 * @dev ERC-20 wrapper for SYLOS token with PoP reward functionality
 * Features:
 * - 1:1 wrapped version of SYLOS token
 * - Burnable for PoP reward redemption
 * - Staking rewards distribution
 * - Time-locked bonus system
 * - Emergency unstick functions
 */
contract WrappedSYLOS is ERC20Wrapper, ERC20Burnable, AccessControl, ReentrancyGuard, Pausable {

    bytes32 public constant WRAPPER_ROLE = keccak256("WRAPPER_ROLE");
    bytes32 public constant REWARD_MANAGER_ROLE = keccak256("REWARD_MANAGER_ROLE");

    // Reward distribution
    struct RewardPeriod {
        uint256 startTime;
        uint256 endTime;
        uint256 rewardRate; // rewards per second for total supply
        uint256 lastUpdateTime;
    }

    struct UserInfo {
        uint256 rewards; // accumulated rewards
        uint256 lastRewardClaim; // last time rewards were claimed
        uint256 depositTime; // when tokens were deposited
    }

    mapping(address => RewardPeriod) public rewardPeriods;
    mapping(address => UserInfo) public userInfo;
    uint256 public totalRewardsDistributed = 0;
    uint256 public totalRewardsAccrued = 0;

    // Staking bonuses
    struct StakingBonus {
        uint256 minDuration; // minimum staking duration in seconds
        uint256 bonusMultiplier; // bonus in basis points (1000 = 10% bonus)
    }

    StakingBonus[] public stakingBonuses;

    // Events
    event RewardsDistributed(address indexed user, uint256 amount, uint256 period);
    event RewardPeriodAdded(address indexed user, uint256 startTime, uint256 endTime, uint256 rewardRate);
    event StakingBonusAdded(uint256 minDuration, uint256 bonusMultiplier);
    event EmergencyUnstake(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);

    constructor(
        IERC20 underlyingToken,
        string memory name,
        string memory symbol
    ) ERC20Wrapper(name, symbol, underlyingToken) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(WRAPPER_ROLE, msg.sender);
        _grantRole(REWARD_MANAGER_ROLE, msg.sender);

        // Initialize default staking bonus
        stakingBonuses.push(StakingBonus(30 days, 1000)); // 10% bonus for 30+ days
        stakingBonuses.push(StakingBonus(90 days, 2000)); // 20% bonus for 90+ days
        stakingBonuses.push(StakingBonus(180 days, 5000)); // 50% bonus for 180+ days
    }

    // Override required by Solidity
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, Pausable) {
        require(!paused(), "WrappedSYLOS: transfer while paused");
        super._beforeTokenTransfer(from, to, amount);
    }

    // Wrapper functions
    function depositFor(address account, uint256 amount) public override whenNotPaused returns (bool) {
        bool success = super.depositFor(account, amount);
        if (success) {
            // Update user deposit time
            userInfo[account].depositTime = block.timestamp;
        }
        return success;
    }

    function withdrawTo(address account, uint256 amount) public override whenNotPaused returns (bool) {
        // Calculate rewards before withdrawal
        _updateUserRewards(msg.sender);
        
        bool success = super.withdrawTo(account, amount);
        if (success) {
            // Reset deposit time
            userInfo[msg.sender].depositTime = block.timestamp;
        }
        return success;
    }

    // Reward management
    function addRewardPeriod(
        address user,
        uint256 startTime,
        uint256 endTime,
        uint256 rewardRate
    ) public onlyRole(REWARD_MANAGER_ROLE) {
        require(endTime > startTime, "Invalid time period");
        require(rewardRate > 0, "Invalid reward rate");

        RewardPeriod storage period = rewardPeriods[user];
        period.startTime = startTime;
        period.endTime = endTime;
        period.rewardRate = rewardRate;
        period.lastUpdateTime = startTime;

        emit RewardPeriodAdded(user, startTime, endTime, rewardRate);
    }

    function calculateUserRewards(address account) public view returns (uint256) {
        UserInfo storage user = userInfo[account];
        RewardPeriod storage period = rewardPeriods[account];
        
        if (block.timestamp < period.startTime || block.timestamp > period.endTime || period.rewardRate == 0) {
            return user.rewards;
        }

        uint256 timeDiff = block.timestamp - max(period.lastUpdateTime, period.startTime);
        uint256 baseReward = (balanceOf(account) * timeDiff * period.rewardRate) / (1e18);
        
        // Apply staking bonus
        uint256 bonus = _getStakingBonus(account);
        uint256 totalReward = baseReward * (10000 + bonus) / 10000;

        return user.rewards + totalReward;
    }

    function claimRewards() public whenNotPaused {
        _updateUserRewards(msg.sender);
        uint256 rewards = userInfo[msg.sender].rewards;
        
        require(rewards > 0, "No rewards to claim");
        
        userInfo[msg.sender].rewards = 0;
        userInfo[msg.sender].lastRewardClaim = block.timestamp;
        
        // Mint rewards (assuming a reward token)
        _mint(msg.sender, rewards);
        totalRewardsDistributed += rewards;
        
        emit RewardClaimed(msg.sender, rewards);
    }

    function _updateUserRewards(address account) internal {
        userInfo[account].rewards = calculateUserRewards(account);
        rewardPeriods[account].lastUpdateTime = block.timestamp;
    }

    // Staking bonus calculation
    function _getStakingBonus(address account) internal view returns (uint256) {
        uint256 timeStaked = block.timestamp - userInfo[account].depositTime;
        uint256 maxBonus = 0;
        
        for (uint256 i = 0; i < stakingBonuses.length; i++) {
            if (timeStaked >= stakingBonuses[i].minDuration) {
                maxBonus = max(maxBonus, stakingBonuses[i].bonusMultiplier);
            }
        }
        
        return maxBonus;
    }

    // Staking bonus management
    function addStakingBonus(uint256 minDuration, uint256 bonusMultiplier) public onlyRole(REWARD_MANAGER_ROLE) {
        stakingBonuses.push(StakingBonus(minDuration, bonusMultiplier));
        emit StakingBonusAdded(minDuration, bonusMultiplier);
    }

    // Emergency functions
    function emergencyUnstake(address account, uint256 amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(amount <= balanceOf(account), "Insufficient balance");
        
        super.withdrawTo(account, amount);
        userInfo[account].depositTime = block.timestamp;
        
        emit EmergencyUnstake(account, amount);
    }

    // Pause/unpause
    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // View functions
    function getUserInfo(address account) external view returns (
        uint256 rewards,
        uint256 lastRewardClaim,
        uint256 depositTime,
        uint256 timeStaked
    ) {
        UserInfo storage user = userInfo[account];
        timeStaked = block.timestamp > user.depositTime ? block.timestamp - user.depositTime : 0;
        return (user.rewards, user.lastRewardClaim, user.depositTime, timeStaked);
    }

    function getTotalRewardsAccrued() external view returns (uint256) {
        return totalRewardsAccrued;
    }

    // Utility function
    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a : b;
    }
}