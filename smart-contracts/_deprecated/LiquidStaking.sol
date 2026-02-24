// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title LiquidStaking
 * @dev Advanced liquid staking protocol with yield farming and auto-compounding
 */
contract LiquidStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    using Math for uint256;

    // Events
    event Staked(
        address indexed user,
        uint256 amount,
        uint256 sharesMinted
    );

    event Unstaked(
        address indexed user,
        uint256 amount,
        uint256 sharesBurned,
        uint256 rewards
    );

    event RewardsClaimed(
        address indexed user,
        uint256 amount,
        uint256 rewards
    );

    event YieldCompounded(
        uint256 amount,
        uint256 newShares
    );

    event CompoundRewards(
        address indexed user,
        uint256 rewards,
        uint256 sharesMinted
    );

    event FeeUpdated(
        uint256 performanceFee,
        uint256 withdrawalFee
    );

    event ValidatorRegistered(
        address indexed validator,
        bool active
    );

    // State variables
    IERC20 public immutable stakingToken;
    IERC20 public immutable rewardToken;
    
    // Share-based accounting
    uint256 public totalStaked;
    uint256 public totalShares;
    uint256 public totalRewards;
    uint256 public totalFees;
    uint256 public lastYieldDistribution;
    
    // User positions
    mapping(address => UserPosition) public userPositions;
    mapping(address => uint256) public userShares;
    mapping(address => uint256) public pendingRewards;
    mapping(address => uint256) public lastUpdateTime;
    
    // Validator management
    mapping(address => bool) public activeValidators;
    address[] public validators;
    
    // Configuration
    uint256 public performanceFee = 200; // 2% performance fee
    uint256 public withdrawalFee = 50; // 0.5% withdrawal fee
    uint256 public minStakeAmount = 0.01 ether;
    uint256 public maxStakeAmount = 10000 ether;
    uint256 public yieldDistributionInterval = 24 hours;
    
    struct UserPosition {
        uint256 stakedAmount;
        uint256 shares;
        uint256 totalRewardsClaimed;
        uint256 lastUpdateTime;
    }
    
    struct ValidatorInfo {
        bool active;
        uint256 totalStaked;
        uint256 commissionRate;
        uint256 lastPerformanceUpdate;
        bool penalized;
    }
    
    mapping(address => ValidatorInfo) public validatorInfo;
    mapping(address => uint256) public validatorPerformance;
    
    // Modifiers
    modifier onlyValidator() {
        require(activeValidators[msg.sender], "Not an active validator");
        _;
    }
    
    modifier validAmount(uint256 amount) {
        require(amount >= minStakeAmount && amount <= maxStakeAmount, "Invalid stake amount");
        _;
    }

    constructor(
        address _stakingToken,
        address _rewardToken
    ) {
        require(_stakingToken != address(0), "Invalid staking token");
        require(_rewardToken != address(0), "Invalid reward token");
        
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
    }

    /**
     * @dev Stake tokens and receive shares
     */
    function stake(uint256 amount) external payable nonReentrant validAmount(amount) {
        require(amount > 0, "Invalid amount");
        
        // Calculate shares to mint
        uint256 sharesToMint = _calculateShares(amount);
        require(sharesToMint > 0, "Zero shares");
        
        // Transfer tokens from user
        if (msg.value == 0) {
            stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        } else {
            require(msg.value == amount, "ETH amount mismatch");
        }
        
        // Update user position
        _updateUserPosition(msg.sender);
        
        userShares[msg.sender] = userShares[msg.sender].add(sharesToMint);
        userPositions[msg.sender].stakedAmount = userPositions[msg.sender].stakedAmount.add(amount);
        userPositions[msg.sender].lastUpdateTime = block.timestamp;
        
        // Update global variables
        totalStaked = totalStaked.add(amount);
        totalShares = totalShares.add(sharesToMint);
        
        // Distribute stake to validators
        _distributeStakeToValidators(amount);
        
        emit Staked(msg.sender, amount, sharesToMint);
    }

    /**
     * @dev Unstake tokens and burn shares
     */
    function unstake(uint256 shares) external nonReentrant {
        require(shares > 0, "Invalid shares amount");
        require(userShares[msg.sender] >= shares, "Insufficient shares");
        
        // Calculate amount to withdraw
        uint256 amountToWithdraw = _calculateAmount(shares);
        require(amountToWithdraw > 0, "Zero amount");
        
        // Update user position
        _updateUserPosition(msg.sender);
        
        // Calculate rewards
        uint256 rewards = pendingRewards[msg.sender];
        
        // Apply withdrawal fee
        uint256 fee = amountToWithdraw.mul(withdrawalFee).div(10000);
        uint256 netAmount = amountToWithdraw.sub(fee);
        
        // Update global variables
        totalShares = totalShares.sub(shares);
        totalStaked = totalStaked.sub(amountToWithdraw);
        totalFees = totalFees.add(fee);
        
        // Update user position
        userShares[msg.sender] = userShares[msg.sender].sub(shares);
        userPositions[msg.sender].stakedAmount = userPositions[msg.sender].stakedAmount.sub(amountToWithdraw);
        userPositions[msg.sender].totalRewardsClaimed = userPositions[msg.sender].totalRewardsClaimed.add(rewards);
        userPositions[msg.sender].lastUpdateTime = block.timestamp;
        
        // Reset pending rewards
        pendingRewards[msg.sender] = 0;
        
        // Withdraw from validators
        _withdrawFromValidators(amountToWithdraw);
        
        // Transfer tokens to user
        if (msg.value > 0) {
            // Native token stake
            payable(msg.sender).transfer(netAmount);
        } else {
            stakingToken.safeTransfer(msg.sender, netAmount);
        }
        
        // Transfer rewards
        if (rewards > 0) {
            rewardToken.safeTransfer(msg.sender, rewards);
        }
        
        emit Unstaked(msg.sender, amountToWithdraw, shares, rewards);
    }

    /**
     * @dev Claim accumulated rewards
     */
    function claimRewards() external nonReentrant {
        _updateUserPosition(msg.sender);
        
        uint256 rewards = pendingRewards[msg.sender];
        require(rewards > 0, "No pending rewards");
        
        pendingRewards[msg.sender] = 0;
        userPositions[msg.sender].totalRewardsClaimed = userPositions[msg.sender].totalRewardsClaimed.add(rewards);
        
        rewardToken.safeTransfer(msg.sender, rewards);
        
        emit RewardsClaimed(msg.sender, 0, rewards);
    }

    /**
     * @dev Compound rewards (stake automatically)
     */
    function compoundRewards() external nonReentrant {
        _updateUserPosition(msg.sender);
        
        uint256 rewards = pendingRewards[msg.sender];
        require(rewards > 0, "No pending rewards");
        
        pendingRewards[msg.sender] = 0;
        userPositions[msg.sender].totalRewardsClaimed = userPositions[msg.sender].totalRewardsClaimed.add(rewards);
        
        // Calculate shares from rewards
        uint256 sharesToMint = _calculateShares(rewards);
        
        // Update global variables
        totalShares = totalShares.add(sharesToMint);
        userShares[msg.sender] = userShares[msg.sender].add(sharesToMint);
        userPositions[msg.sender].stakedAmount = userPositions[msg.sender].stakedAmount.add(rewards);
        userPositions[msg.sender].lastUpdateTime = block.timestamp;
        
        emit CompoundRewards(msg.sender, rewards, sharesToMint);
    }

    /**
     * @dev Distribute yield from validators
     */
    function distributeYield() external onlyValidator {
        require(block.timestamp >= lastYieldDistribution.add(yieldDistributionInterval), "Too early");
        
        uint256 totalYield = _getTotalValidatorYield();
        require(totalYield > 0, "No yield to distribute");
        
        // Calculate performance fee
        uint256 fee = totalYield.mul(performanceFee).div(10000);
        uint256 netYield = totalYield.sub(fee);
        
        // Distribute rewards to users based on share ratio
        if (totalShares > 0) {
            uint256 totalRewardTokens = rewardToken.balanceOf(address(this)).sub(totalRewards);
            if (totalRewardTokens > 0) {
                uint256 totalTokens = netYield.add(totalRewardTokens);
                totalRewards = totalRewards.add(netYield);
                
                // Distribute to all users proportionally
                _distributeRewardsToUsers(totalTokens);
            }
        }
        
        totalFees = totalFees.add(fee);
        lastYieldDistribution = block.timestamp;
        
        emit YieldCompounded(totalYield, 0);
    }

    /**
     * @dev Register a new validator
     */
    function registerValidator(address validator) external onlyOwner {
        require(!activeValidators[validator], "Already active validator");
        require(validator != address(0), "Invalid validator address");
        
        activeValidators[validator] = true;
        validators.push(validator);
        
        validatorInfo[validator] = ValidatorInfo({
            active: true,
            totalStaked: 0,
            commissionRate: 500, // 5% default commission
            lastPerformanceUpdate: block.timestamp,
            penalized: false
        });
        
        emit ValidatorRegistered(validator, true);
    }

    /**
     * @dev Deactivate a validator
     */
    function deactivateValidator(address validator) external onlyOwner {
        require(activeValidators[validator], "Not an active validator");
        
        activeValidators[validator] = false;
        
        emit ValidatorRegistered(validator, false);
    }

    /**
     * @dev Get user position details
     */
    function getUserPosition(address user) external view returns (
        uint256 stakedAmount,
        uint256 shares,
        uint256 pendingRewards,
        uint256 totalRewardsClaimed,
        uint256 lastUpdateTime,
        uint256 currentValue
    ) {
        UserPosition memory position = userPositions[user];
        uint256 rewards = _calculateUserRewards(user);
        uint256 currentShareValue = totalStaked > 0 ? totalStaked.mul(userShares[user]).div(totalShares) : 0;
        
        return (
            position.stakedAmount,
            userShares[user],
            rewards,
            position.totalRewardsClaimed,
            position.lastUpdateTime,
            currentShareValue.add(rewards)
        );
    }

    /**
     * @dev Calculate current APY
     */
    function getCurrentAPY() external view returns (uint256) {
        if (totalStaked == 0) return 0;
        
        uint256 yearlyReward = _getTotalValidatorYield() * 365 days / yieldDistributionInterval;
        return yearlyReward.mul(1e18).div(totalStaked);
    }

    /**
     * @dev Calculate shares from amount
     */
    function _calculateShares(uint256 amount) internal view returns (uint256) {
        if (totalShares == 0) {
            return amount;
        }
        return amount.mul(totalShares).div(totalStaked);
    }

    /**
     * @dev Calculate amount from shares
     */
    function _calculateAmount(uint256 shares) internal view returns (uint256) {
        if (totalShares == 0) {
            return shares;
        }
        return shares.mul(totalStaked).div(totalShares);
    }

    /**
     * @dev Update user position and calculate rewards
     */
    function _updateUserPosition(address user) internal {
        uint256 timeDelta = block.timestamp.sub(lastUpdateTime[user]);
        
        if (timeDelta > 0 && userShares[user] > 0) {
            uint256 userReward = _calculateUserRewards(user);
            pendingRewards[user] = pendingRewards[user].add(userReward);
        }
        
        lastUpdateTime[user] = block.timestamp;
    }

    /**
     * @dev Calculate user rewards
     */
    function _calculateUserRewards(address user) internal view returns (uint256) {
        if (totalShares == 0) return 0;
        
        uint256 userShareRatio = userShares[user].mul(1e18).div(totalShares);
        uint256 pendingTotalRewards = totalRewards;
        
        return pendingTotalRewards.mul(userShareRatio).div(1e18);
    }

    /**
     * @dev Distribute stake to validators
     */
    function _distributeStakeToValidators(uint256 amount) internal {
        if (validators.length == 0) return;
        
        uint256 amountPerValidator = amount.div(validators.length);
        for (uint256 i = 0; i < validators.length; i++) {
            if (activeValidators[validators[i]]) {
                validatorInfo[validators[i]].totalStaked = validatorInfo[validators[i]].totalStaked.add(amountPerValidator);
            }
        }
    }

    /**
     * @dev Withdraw from validators
     */
    function _withdrawFromValidators(uint256 amount) internal {
        if (validators.length == 0) return;
        
        uint256 amountPerValidator = amount.div(validators.length);
        for (uint256 i = 0; i < validators.length; i++) {
            if (activeValidators[validators[i]]) {
                validatorInfo[validators[i]].totalStaked = validatorInfo[validators[i]].totalStaked.sub(amountPerValidator);
            }
        }
    }

    /**
     * @dev Distribute rewards to users
     */
    function _distributeRewardsToUsers(uint256 totalReward) internal {
        // This would distribute rewards based on share ratios
        // Implementation depends on the specific reward distribution mechanism
    }

    /**
     * @dev Get total yield from validators
     */
    function _getTotalValidatorYield() internal view returns (uint256) {
        uint256 totalYield = 0;
        for (uint256 i = 0; i < validators.length; i++) {
            if (activeValidators[validators[i]]) {
                totalYield = totalYield.add(validatorPerformance[validators[i]]);
            }
        }
        return totalYield;
    }

    /**
     * @dev Update fees
     */
    function updateFees(uint256 newPerformanceFee, uint256 newWithdrawalFee) external onlyOwner {
        require(newPerformanceFee <= 1000, "Performance fee too high"); // Max 10%
        require(newWithdrawalFee <= 500, "Withdrawal fee too high"); // Max 5%
        
        performanceFee = newPerformanceFee;
        withdrawalFee = newWithdrawalFee;
        
        emit FeeUpdated(newPerformanceFee, newWithdrawalFee);
    }

    /**
     * @dev Update yield distribution interval
     */
    function updateYieldDistributionInterval(uint256 newInterval) external onlyOwner {
        require(newInterval >= 1 hours && newInterval <= 30 days, "Invalid interval");
        yieldDistributionInterval = newInterval;
    }

    /**
     * @dev Update stake limits
     */
    function updateStakeLimits(uint256 newMin, uint256 newMax) external onlyOwner {
        require(newMin < newMax, "Invalid limits");
        minStakeAmount = newMin;
        maxStakeAmount = newMax;
    }

    /**
     * @dev Withdraw fees to treasury
     */
    function withdrawFees(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }

    /**
     * @dev Emergency function to recover stuck tokens
     */
    function recoverStuckTokens(address token, uint256 amount) external onlyOwner {
        require(block.timestamp > 1735689600, "Emergency recovery locked");
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @dev View function to check total pending rewards
     */
    function getTotalPendingRewards() external view returns (uint256) {
        return totalRewards;
    }

    /**
     * @dev View function to check if user is staking
     */
    function isStaking(address user) external view returns (bool) {
        return userShares[user] > 0;
    }

    /**
     * @dev View function to get share price
     */
    function getSharePrice() external view returns (uint256) {
        if (totalShares == 0) return 1e18; // Initial price
        return totalStaked.mul(1e18).div(totalShares);
    }

    // Fallback function to receive ETH
    receive() external payable {
        // Handle native token staking
    }
}
