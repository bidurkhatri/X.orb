// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Wrapper.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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
    using SafeERC20 for IERC20;

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
    mapping(address => uint256) public userStakingStartTime;

    // Time-locked bonus system
    struct TimeLockBonus {
        uint256 lockDuration; // duration in seconds
        uint256 bonusRate; // bonus in basis points
    }

    TimeLockBonus[] public timeLockBonuses;
    mapping(address => mapping(uint256 => uint256)) public userTimeLockedAmounts;
    mapping(address => mapping(uint256 => uint256)) public userTimeLockEndTime;

    // Events
    event Wrapped(address indexed user, uint256 amount);
    event Unwrapped(address indexed user, uint256 amount);
    event RewardsAccrued(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardPeriodSet(address indexed manager, uint256 startTime, uint256 endTime, uint256 rewardRate);
    event StakingBonusAdded(uint256 minDuration, uint256 bonusMultiplier);
    event TimeLockBonusAdded(uint256 lockDuration, uint256 bonusRate);
    event TimeLocked(address indexed user, uint256 amount, uint256 lockDuration, uint256 endTime);
    event TimeLockClaimed(address indexed user, uint256 amount);

    constructor(
        address wrappedToken,
        string memory name,
        string memory symbol
    ) 
        ERC20(name, symbol) 
        ERC20Wrapper(ERC20(wrappedToken))
    {
        require(wrappedToken != address(0), "Invalid wrapped token");
        
        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(WRAPPER_ROLE, msg.sender);
        _grantRole(REWARD_MANAGER_ROLE, msg.sender);

        // Add default staking bonuses
        _addStakingBonus(7 days, 100); // 1% bonus for 7+ days
        _addStakingBonus(30 days, 500); // 5% bonus for 30+ days
        _addStakingBonus(90 days, 1000); // 10% bonus for 90+ days
        _addStakingBonus(180 days, 2000); // 20% bonus for 180+ days
        _addStakingBonus(365 days, 5000); // 50% bonus for 365+ days

        // Add default time-lock bonuses
        _addTimeLockBonus(30 days, 200); // 2% bonus for 30-day lock
        _addTimeLockBonus(90 days, 500); // 5% bonus for 90-day lock
        _addTimeLockBonus(180 days, 1000); // 10% bonus for 180-day lock
        _addTimeLockBonus(365 days, 2000); // 20% bonus for 365-day lock
    }

    /**
     * @dev Wrap SYLOS tokens - REENTRANCY PROTECTED
     * @param amount Amount of SYLOS to wrap
     */
    function wrap(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= IERC20(underlying()).balanceOf(msg.sender), "Insufficient SYLOS balance");
        require(amount <= IERC20(underlying()).allowance(msg.sender, address(this)), "Insufficient allowance");
        
        // Transfer SYLOS from user (SafeERC20)
        IERC20(underlying()).safeTransferFrom(msg.sender, address(this), amount);
        
        // Mint wSYLOS tokens
        _mint(msg.sender, amount);
        
        // Update user staking start time if first time
        if (balanceOf(msg.sender) == amount) {
            userStakingStartTime[msg.sender] = block.timestamp;
        }
        
        // Start accruing rewards
        _updateUserReward(msg.sender);
        
        emit Wrapped(msg.sender, amount);
    }

    /**
     * @dev Unwrap wSYLOS tokens - REENTRANCY PROTECTED
     * @param amount Amount of wSYLOS to unwrap
     */
    function unwrap(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(amount <= IERC20(underlying()).balanceOf(address(this)), "Insufficient contract balance");
        
        // Check for time-locked amounts
        require(!_hasTimeLockedAmount(msg.sender, amount), "Amount includes time-locked tokens");
        
        // Update rewards before unstaking
        _updateUserReward(msg.sender);
        
        // Burn wSYLOS tokens
        _burn(msg.sender, amount);
        
        // Return underlying SYLOS tokens (SafeERC20)
        IERC20(underlying()).safeTransfer(msg.sender, amount);
        
        emit Unwrapped(msg.sender, amount);
    }

    /**
     * @dev Time-lock tokens for bonus rewards - REENTRANCY PROTECTED
     * @param amount Amount to lock
     * @param lockDurationIndex Index of lock duration
     */
    function timeLock(uint256 amount, uint256 lockDurationIndex) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(lockDurationIndex < timeLockBonuses.length, "Invalid lock duration");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // Check for existing time-locked amounts
        require(!_hasTimeLockedAmount(msg.sender, amount), "Amount overlaps with time-locked tokens");
        
        TimeLockBonus memory bonus = timeLockBonuses[lockDurationIndex];
        uint256 endTime = block.timestamp + bonus.lockDuration;
        
        // Update user info
        userTimeLockedAmounts[msg.sender][lockDurationIndex] += amount;
        userTimeLockEndTime[msg.sender][lockDurationIndex] = endTime;
        
        // Update rewards before locking
        _updateUserReward(msg.sender);
        
        emit TimeLocked(msg.sender, amount, bonus.lockDuration, endTime);
    }

    /**
     * @dev Claim time-locked tokens after lock period - REENTRANCY PROTECTED
     * @param lockDurationIndex Index of lock duration
     */
    function claimTimeLocked(uint256 lockDurationIndex) external nonReentrant whenNotPaused {
        require(lockDurationIndex < timeLockBonuses.length, "Invalid lock duration");
        
        uint256 lockedAmount = userTimeLockedAmounts[msg.sender][lockDurationIndex];
        uint256 endTime = userTimeLockEndTime[msg.sender][lockDurationIndex];
        
        require(lockedAmount > 0, "No locked tokens");
        require(block.timestamp >= endTime, "Tokens still locked");
        
        // Calculate bonus
        TimeLockBonus memory bonus = timeLockBonuses[lockDurationIndex];
        uint256 bonusAmount = (lockedAmount * bonus.bonusRate) / 10000;
        
        require(bonusAmount <= type(uint256).max / 10000, "Bonus calculation overflow");
        
        uint256 totalAmount = lockedAmount + bonusAmount;
        
        // State updates before external calls (Checks-Effects-Interactions pattern)
        userTimeLockedAmounts[msg.sender][lockDurationIndex] = 0;
        userTimeLockEndTime[msg.sender][lockDurationIndex] = 0;
        
        // Mint bonus tokens
        _mint(msg.sender, bonusAmount);
        totalRewardsAccrued += bonusAmount;
        
        emit TimeLockClaimed(msg.sender, bonusAmount);
    }

    /**
     * @dev Claim accumulated rewards - REENTRANCY PROTECTED
     */
    function claimRewards() external nonReentrant whenNotPaused {
        _updateUserReward(msg.sender);
        
        uint256 rewards = userInfo[msg.sender].rewards;
        require(rewards > 0, "No rewards to claim");
        
        // State updates before external calls (Checks-Effects-Interactions pattern)
        userInfo[msg.sender].rewards = 0;
        
        // Mint reward tokens
        _mint(msg.sender, rewards);
        totalRewardsDistributed += rewards;
        
        emit RewardsClaimed(msg.sender, rewards);
    }

    /**
     * @dev Get pending rewards for a user
     * @param user Address to check rewards for
     */
    function getPendingRewards(address user) public view returns (uint256) {
        UserInfo memory info = userInfo[user];
        RewardPeriod memory period = rewardPeriods[address(this)];
        
        if (block.timestamp <= period.startTime || block.timestamp >= period.endTime) {
            return info.rewards;
        }
        
        uint256 timeDelta = block.timestamp - period.lastUpdateTime;
        uint256 rewardAccrual = (totalSupply() * period.rewardRate * timeDelta) / 1e18;
        
        return info.rewards + rewardAccrual;
    }

    /**
     * @dev Set reward period
     * @param startTime Start time
     * @param endTime End time
     * @param rewardRate Reward rate per second
     */
    function setRewardPeriod(
        uint256 startTime,
        uint256 endTime,
        uint256 rewardRate
    ) external onlyRole(REWARD_MANAGER_ROLE) {
        require(startTime < endTime, "Invalid time range");
        require(block.timestamp <= endTime, "End time must be in future");
        
        rewardPeriods[address(this)] = RewardPeriod({
            startTime: startTime,
            endTime: endTime,
            rewardRate: rewardRate,
            lastUpdateTime: block.timestamp
        });
        
        emit RewardPeriodSet(msg.sender, startTime, endTime, rewardRate);
    }

    /**
     * @dev Add staking bonus
     * @param minDuration Minimum duration in seconds
     * @param bonusMultiplier Bonus in basis points
     */
    function addStakingBonus(uint256 minDuration, uint256 bonusMultiplier) external onlyRole(REWARD_MANAGER_ROLE) {
        _addStakingBonus(minDuration, bonusMultiplier);
    }

    /**
     * @dev Add time-lock bonus
     * @param lockDuration Lock duration in seconds
     * @param bonusRate Bonus in basis points
     */
    function addTimeLockBonus(uint256 lockDuration, uint256 bonusRate) external onlyRole(REWARD_MANAGER_ROLE) {
        _addTimeLockBonus(lockDuration, bonusRate);
    }

    /**
     * @dev Get user staking multiplier
     * @param user Address to check
     */
    function getStakingMultiplier(address user) public view returns (uint256) {
        uint256 balance = balanceOf(user);
        if (balance == 0) return 10000; // 100% (1x)
        
        uint256 stakingDuration = block.timestamp - userStakingStartTime[user];
        uint256 maxMultiplier = 10000; // Base multiplier (1x)
        
        for (uint256 i = 0; i < stakingBonuses.length; i++) {
            if (stakingDuration >= stakingBonuses[i].minDuration) {
                maxMultiplier += stakingBonuses[i].bonusMultiplier;
            }
        }
        
        return maxMultiplier;
    }

    /**
     * @dev Get time-locked amounts for user
     * @param user Address to check
     */
    function getTimeLockedAmounts(address user) external view returns (uint256[] memory) {
        uint256[] memory amounts = new uint256[](timeLockBonuses.length);
        for (uint256 i = 0; i < timeLockBonuses.length; i++) {
            amounts[i] = userTimeLockedAmounts[user][i];
        }
        return amounts;
    }

    /**
     * @dev Check if user has time-locked amount that would affect withdrawal
     * @param user Address to check
     * @param amount Amount to check
     */
    function _hasTimeLockedAmount(address user, uint256 amount) internal view returns (bool) {
        uint256 totalLocked = 0;
        for (uint256 i = 0; i < timeLockBonuses.length; i++) {
            if (userTimeLockedAmounts[user][i] > 0 && block.timestamp < userTimeLockEndTime[user][i]) {
                totalLocked += userTimeLockedAmounts[user][i];
            }
        }
        return totalLocked >= amount;
    }

    /**
     * @dev Update user rewards
     * @param user Address to update
     */
    function _updateUserReward(address user) internal {
        RewardPeriod storage period = rewardPeriods[address(this)];
        
        if (block.timestamp <= period.startTime || block.timestamp >= period.endTime) {
            userInfo[user].lastRewardClaim = block.timestamp;
            return;
        }
        
        uint256 timeDelta = block.timestamp - period.lastUpdateTime;
        
        if (timeDelta > 0) {
            uint256 userShare = (balanceOf(user) * 1e18) / totalSupply();
            uint256 rewardAccrual = (period.rewardRate * timeDelta * userShare) / 1e18;
            
            userInfo[user].rewards += rewardAccrual;
            userInfo[user].lastRewardClaim = block.timestamp;
            period.lastUpdateTime = block.timestamp;
            
            emit RewardsAccrued(user, rewardAccrual);
        }
    }

    /**
     * @dev Add staking bonus (internal)
     * @param minDuration Minimum duration in seconds
     * @param bonusMultiplier Bonus in basis points
     */
    function _addStakingBonus(uint256 minDuration, uint256 bonusMultiplier) internal {
        stakingBonuses.push(StakingBonus({
            minDuration: minDuration,
            bonusMultiplier: bonusMultiplier
        }));
        
        emit StakingBonusAdded(minDuration, bonusMultiplier);
    }

    /**
     * @dev Add time-lock bonus (internal)
     * @param lockDuration Lock duration in seconds
     * @param bonusRate Bonus in basis points
     */
    function _addTimeLockBonus(uint256 lockDuration, uint256 bonusRate) internal {
        timeLockBonuses.push(TimeLockBonus({
            lockDuration: lockDuration,
            bonusRate: bonusRate
        }));
        
        emit TimeLockBonusAdded(lockDuration, bonusRate);
    }

    /**
     * @dev Emergency function to recover accidentally sent tokens - REENTRANCY PROTECTED
     * @param tokenAddress Token address to recover
     * @param amount Amount of tokens to recover
     */
    function recoverTokens(address tokenAddress, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(tokenAddress != address(0), "Invalid token address");
        require(tokenAddress != address(underlying()), "Cannot recover underlying token");
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= IERC20(tokenAddress).balanceOf(address(this)), "Insufficient balance");
        
        IERC20(tokenAddress).transfer(msg.sender, amount);
    }
    
    /**
     * @dev Pause contract
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Overrides decimals to match the OpenZeppelin V5 ERC20Wrapper specification
     */
    function decimals() public view override(ERC20, ERC20Wrapper) returns (uint8) {
        return super.decimals();
    }
}
