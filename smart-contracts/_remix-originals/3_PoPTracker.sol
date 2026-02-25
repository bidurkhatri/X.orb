// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PoPTracker
 * @dev Productivity Proof (PoP) tracking and reward distribution contract
 * Features:
 * - Verifiable productivity metrics
 * - Multi-criteria scoring system
 * - Reward distribution based on productivity
 * - Time-based assessments
 * - Peer review and validation
 * - Anti-gaming mechanisms
 */
contract PoPTracker is AccessControl, ReentrancyGuard, Pausable {

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    // Productivity metrics
    struct ProductivityMetrics {
        uint256 taskCompletion; // 0-1000 (0-100%)
        uint256 codeQuality; // 0-1000 (0-100%)
        uint256 collaborationScore; // 0-1000 (0-100%)
        uint256 innovationIndex; // 0-1000 (0-100%)
        uint256 impactScore; // 0-1000 (0-100%)
        uint256 timeEfficiency; // 0-1000 (0-100%)
    }

    struct UserProfile {
        uint256 totalTasks;
        uint256 completedTasks;
        uint256 totalScore;
        uint256 averageScore;
        uint256 lastUpdateTime;
        uint256 consecutiveDaysActive;
        bool isActive;
    }

    struct ProductivityRecord {
        uint256 timestamp;
        ProductivityMetrics metrics;
        uint256 totalScore;
        string evidence; // IPFS hash or encrypted data
        bytes32 evidenceHash; // Hash of evidence
        address validator;
    }

    struct Task {
        uint256 id;
        string description;
        uint256 deadline;
        uint256 maxScore;
        address assignee;
        bool isCompleted;
        bool isVerified;
        uint256 actualScore;
    }

    // Storage
    mapping(address => UserProfile) public userProfiles;
    mapping(address => ProductivityRecord[]) private userRecords;
    mapping(address => mapping(uint256 => bool)) public hasRecord;
    mapping(uint256 => Task) public tasks;
    uint256 public taskCount;
    
    IERC20 public rewardToken;
    uint256 public baseRewardRate; // base rewards per score point
    uint256 public totalRewardsDistributed;

    // Events
    event RecordCreated(address indexed user, uint256 timestamp, uint256 totalScore);
    event TaskCreated(uint256 taskId, string description, uint256 deadline, address assignee);
    event TaskCompleted(uint256 taskId, address indexed user, uint256 score);
    event TaskVerified(uint256 taskId, address indexed validator, uint256 score);
    event RewardsDistributed(address indexed user, uint256 amount, uint256 score);
    event UserActivated(address indexed user);
    event UserDeactivated(address indexed user);

    constructor(
        IERC20 _rewardToken,
        address _treasury,
        address _admin
    ) {
        rewardToken = _rewardToken;
        baseRewardRate = 100; // 100 reward tokens per score point

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MANAGER_ROLE, _admin);
        _grantRole(VALIDATOR_ROLE, _admin);
        _grantRole(VERIFIER_ROLE, _admin);

        // Treasury can also validate
        _grantRole(VALIDATOR_ROLE, _treasury);
    }

    // Record management
    function createProductivityRecord(
        address user,
        ProductivityMetrics memory metrics,
        string memory evidence
    ) public onlyRole(VALIDATOR_ROLE) nonReentrant whenNotPaused {
        require(user != address(0), "Invalid user");
        require(!hasRecord[user][block.timestamp], "Record already exists for this period");

        // Calculate total score (weighted average)
        uint256 totalScore = _calculateTotalScore(metrics);
        
        // Update user profile
        _updateUserProfile(user, totalScore);
        
        // Create record
        ProductivityRecord memory newRecord = ProductivityRecord({
            timestamp: block.timestamp,
            metrics: metrics,
            totalScore: totalScore,
            evidence: evidence,
            evidenceHash: keccak256(abi.encodePacked(evidence)),
            validator: msg.sender
        });

        userRecords[user].push(newRecord);
        hasRecord[user][block.timestamp] = true;

        // Distribute rewards
        _distributeRewards(user, totalScore);

        emit RecordCreated(user, block.timestamp, totalScore);
    }

    function _calculateTotalScore(ProductivityMetrics memory metrics) internal pure returns (uint256) {
        // Weighted scoring (you can adjust weights as needed)
        uint256 weight1 = 200; // taskCompletion: 20%
        uint256 weight2 = 150; // codeQuality: 15%
        uint256 weight3 = 150; // collaborationScore: 15%
        uint256 weight4 = 200; // innovationIndex: 20%
        uint256 weight5 = 200; // impactScore: 20%
        uint256 weight6 = 100; // timeEfficiency: 10%
        
        return (
            (metrics.taskCompletion * weight1 +
            metrics.codeQuality * weight2 +
            metrics.collaborationScore * weight3 +
            metrics.innovationIndex * weight4 +
            metrics.impactScore * weight5 +
            metrics.timeEfficiency * weight6) / 1000
        );
    }

    function _updateUserProfile(address user, uint256 score) internal {
        UserProfile storage profile = userProfiles[user];
        
        if (!profile.isActive) {
            profile.isActive = true;
            emit UserActivated(user);
        }

        profile.totalScore += score;
        profile.averageScore = profile.totalScore / (userRecords[user].length + 1);
        profile.lastUpdateTime = block.timestamp;
        profile.consecutiveDaysActive = _calculateConsecutiveDays(user, block.timestamp);
    }

    function _calculateConsecutiveDays(address user, uint256 currentTime) internal view returns (uint256) {
        ProductivityRecord[] storage records = userRecords[user];
        if (records.length == 0) return 0;

        uint256 lastRecordTime = records[records.length - 1].timestamp;
        uint256 lastRecordDay = (lastRecordTime / 1 days) * 1 days;
        uint256 currentDay = (currentTime / 1 days) * 1 days;

        if (currentDay == lastRecordDay) {
            return userProfiles[user].consecutiveDaysActive;
        } else if (currentDay - lastRecordDay == 1 days) {
            return userProfiles[user].consecutiveDaysActive + 1;
        } else {
            return 1; // Reset
        }
    }

    function _distributeRewards(address user, uint256 score) internal {
        uint256 rewardAmount = (score * baseRewardRate) / 1000;
        
        if (rewardAmount > 0 && rewardToken.balanceOf(address(this)) >= rewardAmount) {
            rewardToken.transfer(user, rewardAmount);
            totalRewardsDistributed += rewardAmount;
            emit RewardsDistributed(user, rewardAmount, score);
        }
    }

    // Task management
    function createTask(
        string memory description,
        uint256 deadline,
        address assignee
    ) public onlyRole(MANAGER_ROLE) returns (uint256) {
        taskCount++;
        tasks[taskCount] = Task({
            id: taskCount,
            description: description,
            deadline: deadline,
            maxScore: 1000, // Default max score
            assignee: assignee,
            isCompleted: false,
            isVerified: false,
            actualScore: 0
        });

        emit TaskCreated(taskCount, description, deadline, assignee);
        return taskCount;
    }

    function completeTask(uint256 taskId) public {
        Task storage task = tasks[taskId];
        require(task.assignee == msg.sender, "Not task assignee");
        require(!task.isCompleted, "Task already completed");
        require(block.timestamp <= task.deadline, "Task deadline passed");

        task.isCompleted = true;
        emit TaskCompleted(taskId, msg.sender, task.actualScore);
    }

    function verifyTask(uint256 taskId, uint256 score) public onlyRole(VERIFIER_ROLE) {
        Task storage task = tasks[taskId];
        require(task.isCompleted, "Task not completed");
        require(!task.isVerified, "Task already verified");
        require(score <= task.maxScore, "Score exceeds maximum");

        task.isVerified = true;
        task.actualScore = score;

        emit TaskVerified(taskId, msg.sender, score);
    }

    // Configuration
    function setBaseRewardRate(uint256 newRate) public onlyRole(MANAGER_ROLE) {
        baseRewardRate = newRate;
    }

    // Emergency functions
    function activateUser(address user) public onlyRole(MANAGER_ROLE) {
        userProfiles[user].isActive = true;
        emit UserActivated(user);
    }

    function deactivateUser(address user) public onlyRole(MANAGER_ROLE) {
        userProfiles[user].isActive = false;
        emit UserDeactivated(user);
    }

    function pause() public onlyRole(MANAGER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    // View functions
    function getUserProfile(address user) external view returns (UserProfile memory) {
        return userProfiles[user];
    }

    function getUserRecords(address user) external view returns (ProductivityRecord[] memory) {
        return userRecords[user];
    }

    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    function getTotalRecords(address user) external view returns (uint256) {
        return userRecords[user].length;
    }

    // Emergency token recovery
    function recoverTokens(address token, uint256 amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).transfer(msg.sender, amount);
    }
}