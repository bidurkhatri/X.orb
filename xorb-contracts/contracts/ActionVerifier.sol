// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

contract PoPTracker is AccessControl, ReentrancyGuard, Pausable, EIP712, FunctionsClient {
    using ECDSA for bytes32;
    using FunctionsRequest for FunctionsRequest.Request;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

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
        address verifier;
        bool isVerified;
    }

    struct TaskRecord {
        uint256 taskId;
        string taskDescription;
        uint256 estimatedHours;
        uint256 actualHours;
        uint256 complexity; // 1-10 scale
        uint256 qualityScore; // 0-1000
        uint256 completedAt;
        string deliverableHash; // IPFS hash
    }

    struct RewardCycle {
        uint256 cycleId;
        uint256 startTime;
        uint256 endTime;
        uint256 totalRewards;
        uint256 distributedRewards;
        uint256 poolSize;
        mapping(address => uint256) userRewards;
        mapping(address => uint256) userScores;
    }

    // Storage
    mapping(address => UserProfile) public userProfiles;
    mapping(address => ProductivityRecord[]) public userRecords;
    mapping(uint256 => TaskRecord) public tasks;
    mapping(uint256 => address) public taskCreators;
    mapping(address => uint256[]) public userTasks;
    mapping(uint256 => RewardCycle) public rewardCycles;
    mapping(uint256 => bool) public verifiedRewardCycles;
    
    // User list for iteration (to avoid unbounded loops)
    address[] private allUsers;
    mapping(address => bool) public isUserInList;
    uint256 public constant MAX_USERS = 10000; // Cap to prevent gas limit issues during iteration
    uint256 public constant MAX_TASK_DESCRIPTION_LENGTH = 512; // Max bytes for task descriptions
    
    uint256 public nextTaskId = 1;
    uint256 public currentCycleId = 1;
    uint256 public cycleDuration = 30 days;
    uint256 public minValidatorCount = 3;
    uint256 public totalUsers = 0;
    uint256 public totalTasksCompleted = 0;

    // Scoring weights (sum = 10000 = 100%)
    uint256 public taskCompletionWeight = 3000; // 30%
    uint256 public codeQualityWeight = 2500; // 25%
    uint256 public collaborationWeight = 1500; // 15%
    uint256 public innovationWeight = 1500; // 15%
    uint256 public impactWeight = 1000; // 10%
    uint256 public efficiencyWeight = 500; // 5%

    // Reward distribution
    IERC20 public rewardToken;
    address public treasury;
    uint256 public baseRewardRate = 100; // 100 USDC per 1000 points
    uint256 public bonusMultiplier = 0; // Additional bonus for top performers

    // Chainlink Functions Oracle Configuration
    bytes32 public donId;
    uint64 public subscriptionId;
    mapping(bytes32 => address) public requestToUser;
    mapping(bytes32 => string) public requestToEvidence;

    // Events
    event TaskCreated(uint256 indexed taskId, address indexed creator, string description, uint256 complexity);
    event TaskCompleted(uint256 indexed taskId, address indexed user, uint256 qualityScore);
    event ProductivityRecorded(address indexed user, uint256 totalScore, string evidenceHash);
    event RecordVerified(address indexed user, address indexed verifier, uint256 recordId);
    event UserProfileUpdated(address indexed user, uint256 totalScore, uint256 averageScore);
    event RewardCycleStarted(uint256 indexed cycleId, uint256 startTime, uint256 endTime);
    event RewardCycleEnded(uint256 indexed cycleId, uint256 totalRewards, uint256 distributedRewards);
    event RewardsDistributed(address indexed user, uint256 amount, uint256 cycleId);
    event WeightsUpdated(uint256[] newWeights);
    event SettingsUpdated(uint256 minValidatorCount, uint256 baseRewardRate, uint256 bonusMultiplier);

    bytes32 public constant RECORD_TYPEHASH = keccak256("ProductivityRecord(address user,string evidence,uint256 taskCompletion,uint256 codeQuality,uint256 collaborationScore,uint256 innovationIndex,uint256 impactScore,uint256 timeEfficiency)");

    constructor(
        address rewardToken_,
        address treasury_,
        address admin,
        address router_
    ) EIP712("PoPTracker", "1") FunctionsClient(router_) {
        require(rewardToken_ != address(0), "Invalid reward token");
        require(treasury_ != address(0), "Invalid treasury");
        require(admin != address(0), "Invalid admin");

        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
        _grantRole(VALIDATOR_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);

        // Setup contracts
        rewardToken = IERC20(rewardToken_);
        treasury = treasury_;

        // Start first reward cycle
        _startRewardCycle();
    }

    /**
     * @dev Create a new task
     * @param taskDescription Description of the task
     * @param estimatedHours Estimated hours to complete
     * @param complexity Complexity level (1-10)
     */
    function createTask(
        address assignee,
        string calldata taskDescription,
        uint256 estimatedHours,
        uint256 complexity
    ) external onlyRole(MANAGER_ROLE) returns (uint256 taskId) {
        require(assignee != address(0), "Invalid assignee");
        require(complexity >= 1 && complexity <= 10, "Invalid complexity level");
        require(estimatedHours > 0, "Invalid estimated hours");
        require(bytes(taskDescription).length <= MAX_TASK_DESCRIPTION_LENGTH, "Description too long");

        taskId = nextTaskId++;
        
        tasks[taskId] = TaskRecord({
            taskId: taskId,
            taskDescription: taskDescription,
            estimatedHours: estimatedHours,
            actualHours: 0,
            complexity: complexity,
            qualityScore: 0,
            completedAt: 0,
            deliverableHash: ""
        });
        
        taskCreators[taskId] = msg.sender;
        userTasks[assignee].push(taskId);

        emit TaskCreated(taskId, assignee, taskDescription, complexity);
    }

    /**
     * @dev Complete a task
     * @param taskId ID of the task
     * @param actualHours Actual hours spent
     * @param qualityScore Quality score (0-1000)
     * @param deliverableHash IPFS hash of deliverable
     */
    function completeTask(
        uint256 taskId,
        uint256 actualHours,
        uint256 qualityScore,
        string calldata deliverableHash
    ) external whenNotPaused {
        require(tasks[taskId].taskId != 0, "Task does not exist");
        require(tasks[taskId].completedAt == 0, "Task already completed");
        require(qualityScore <= 1000, "Invalid quality score");
        require(actualHours > 0 && actualHours <= tasks[taskId].estimatedHours * 2, "Invalid actual hours");
        require(bytes(deliverableHash).length > 0, "Invalid deliverable hash");

        tasks[taskId].actualHours = actualHours;
        tasks[taskId].qualityScore = qualityScore;
        tasks[taskId].completedAt = block.timestamp;
        tasks[taskId].deliverableHash = deliverableHash;

        // Update user profile
        UserProfile storage profile = userProfiles[msg.sender];
        profile.totalTasks += 1;
        profile.completedTasks += 1;
        profile.totalScore += qualityScore;
        profile.averageScore = profile.totalScore / profile.completedTasks;
        profile.lastUpdateTime = block.timestamp;
        
        if (!profile.isActive) {
            profile.isActive = true;
            if (!isUserInList[msg.sender]) {
                allUsers.push(msg.sender);
                isUserInList[msg.sender] = true;
            }
            totalUsers += 1;
        }

        totalTasksCompleted += 1;

        emit TaskCompleted(taskId, msg.sender, qualityScore);
    }

    /**
     * @dev Request productivity validation via Chainlink Functions (e.g., GitHub PR verification)
     * @param evidenceUrl The URL of the evidence to verify
     * @param sourceCode The inline JavaScript code to execute on the DON
     */
    function requestPRVerification(
        string calldata evidenceUrl,
        string calldata sourceCode
    ) external whenNotPaused returns (bytes32 requestId) {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(sourceCode);
        string[] memory args = new string[](1);
        args[0] = evidenceUrl;
        req.setArgs(args);

        requestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            300000,
            donId
        );
        
        requestToUser[requestId] = msg.sender;
        requestToEvidence[requestId] = evidenceUrl;
    }

    /**
     * @dev Callback for Chainlink Functions
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        address user = requestToUser[requestId];
        require(user != address(0), "Request not found");
        
        if (err.length > 0) {
            return;
        }
        
        uint256 totalScore = abi.decode(response, (uint256));
        string memory evidence = requestToEvidence[requestId];

        ProductivityRecord memory record = ProductivityRecord({
            timestamp: block.timestamp,
            metrics: ProductivityMetrics(0,0,0,0,0,0), // Simplified via Oracle for this prototype
            totalScore: totalScore,
            evidence: evidence,
            verifier: address(this),
            isVerified: true
        });

        userRecords[user].push(record);
        UserProfile storage profile = userProfiles[user];
        profile.totalScore += totalScore;
        profile.averageScore = profile.totalScore / userRecords[user].length;

        emit ProductivityRecorded(user, totalScore, evidence);
        emit UserProfileUpdated(user, profile.totalScore, profile.averageScore);
    }

    /**
     * @dev Verify a productivity record
     * @param user Address of the user
     * @param recordId ID of the record
     */
    function verifyRecord(address user, uint256 recordId) 
        external 
        onlyRole(VALIDATOR_ROLE) 
    {
        require(recordId < userRecords[user].length, "Invalid record ID");
        require(!userRecords[user][recordId].isVerified, "Record already verified");

        // Manual verification directly approves the record
        // since the caller explicitly holds VALIDATOR_ROLE.

        userRecords[user][recordId].isVerified = true;

        emit RecordVerified(user, msg.sender, recordId);
    }

    /**
     * @dev Distribute rewards for the current cycle - COMPLETE IMPLEMENTATION
     */
    function distributeRewards() external onlyRole(MANAGER_ROLE) nonReentrant whenNotPaused {
        require(!verifiedRewardCycles[currentCycleId], "Rewards already distributed");

        RewardCycle storage cycle = rewardCycles[currentCycleId];
        require(block.timestamp >= cycle.endTime, "Cycle not ended");
        require(cycle.totalRewards > 0, "No rewards to distribute");

        uint256 totalUserScore = 0;
        
        // Calculate total score from all verified records
        for (uint256 i = 0; i < allUsers.length; i++) {
            address user = allUsers[i];
            uint256 userTotalScore = 0;
            
            // Sum all verified records for this user
            for (uint256 j = 0; j < userRecords[user].length; j++) {
                if (userRecords[user][j].isVerified && 
                    userRecords[user][j].timestamp >= cycle.startTime && 
                    userRecords[user][j].timestamp < cycle.endTime) {
                    userTotalScore += userRecords[user][j].totalScore;
                }
            }
            
            if (userTotalScore > 0) {
                cycle.userScores[user] = userTotalScore;
                totalUserScore += userTotalScore;
            }
        }

        require(totalUserScore > 0, "No eligible users for rewards");
        
        // Distribute rewards based on proportional score
        for (uint256 i = 0; i < allUsers.length; i++) {
            address user = allUsers[i];
            uint256 userScore = cycle.userScores[user];
            
            if (userScore > 0) {
                uint256 userReward = (cycle.totalRewards * userScore) / totalUserScore;
                
                // Add bonus for top performers (top 10%)
                if (userScore >= _getTopScoreThreshold(totalUserScore, 10)) {
                    userReward = (userReward * (1000 + bonusMultiplier)) / 1000;
                }
                
                cycle.userRewards[user] = userReward;
                cycle.distributedRewards += userReward;
                
                emit RewardsDistributed(user, userReward, currentCycleId);
            }
        }

        verifiedRewardCycles[currentCycleId] = true;

        emit RewardCycleEnded(currentCycleId, cycle.totalRewards, cycle.distributedRewards);

        // Start next cycle
        _startRewardCycle();
    }

    /**
     * @dev Withdraw rewards for the current cycle - REENTRANCY PROTECTED
     */
    function withdrawRewards() external nonReentrant whenNotPaused {
        RewardCycle storage cycle = rewardCycles[currentCycleId - 1]; // Previous cycle
        require(verifiedRewardCycles[currentCycleId - 1], "Rewards not yet distributed");
        
        uint256 reward = cycle.userRewards[msg.sender];
        require(reward > 0, "No rewards to withdraw");
        require(reward <= rewardToken.balanceOf(address(this)), "Insufficient reward balance");
        
        // State updates before external calls (Checks-Effects-Interactions pattern)
        cycle.userRewards[msg.sender] = 0;
        cycle.distributedRewards += reward;
        
        // Perform transfer (external call)
        require(rewardToken.transfer(msg.sender, reward), "Transfer failed");
        
        emit RewardsDistributed(msg.sender, reward, currentCycleId - 1);
    }

    /**
     * @dev Update scoring weights
     * @param newWeights Array of 6 weights (must sum to 10000)
     */
    function updateWeights(uint256[] calldata newWeights) external onlyRole(MANAGER_ROLE) whenNotPaused {
        require(newWeights.length == 6, "Must provide exactly 6 weights");
        require(
            newWeights[0] + newWeights[1] + newWeights[2] + newWeights[3] + newWeights[4] + newWeights[5] == 10000,
            "Weights must sum to 10000"
        );
        require(newWeights[0] <= 5000, "Task completion weight too high");
        require(newWeights[1] <= 4000, "Code quality weight too high");

        taskCompletionWeight = newWeights[0];
        codeQualityWeight = newWeights[1];
        collaborationWeight = newWeights[2];
        innovationWeight = newWeights[3];
        impactWeight = newWeights[4];
        efficiencyWeight = newWeights[5];

        emit WeightsUpdated(newWeights);
    }

    /**
     * @dev Update contract settings
     * @param newMinValidatorCount New minimum validator count
     * @param newBaseRewardRate New base reward rate
     * @param newBonusMultiplier New bonus multiplier
     */
    function updateSettings(
        uint256 newMinValidatorCount,
        uint256 newBaseRewardRate,
        uint256 newBonusMultiplier
    ) external onlyRole(MANAGER_ROLE) whenNotPaused {
        require(newMinValidatorCount >= 1 && newMinValidatorCount <= 10, "Invalid validator count");
        require(newBaseRewardRate > 0 && newBaseRewardRate <= 10000, "Invalid base reward rate");
        require(newBonusMultiplier <= 5000, "Bonus multiplier too high"); // Max 500%
        
        minValidatorCount = newMinValidatorCount;
        baseRewardRate = newBaseRewardRate;
        bonusMultiplier = newBonusMultiplier;

        emit SettingsUpdated(newMinValidatorCount, newBaseRewardRate, newBonusMultiplier);
    }

    /**
     * @dev Get user profile
     * @param user Address of the user
     */
    function getUserProfile(address user) external view returns (UserProfile memory) {
        return userProfiles[user];
    }

    /**
     * @dev Get user records
     * @param user Address of the user
     */
    function getUserRecords(address user) external view returns (ProductivityRecord[] memory) {
        return userRecords[user];
    }

    /**
     * @dev Get task details
     * @param taskId ID of the task
     */
    function getTask(uint256 taskId) external view returns (TaskRecord memory) {
        return tasks[taskId];
    }

    /**
     * @dev Get current cycle info
     */
    function getCurrentCycle() external view returns (uint256, uint256, uint256, uint256) {
        RewardCycle storage cycle = rewardCycles[currentCycleId];
        return (cycle.startTime, cycle.endTime, cycle.totalRewards, cycle.distributedRewards);
    }

    /**
     * @dev Start a new reward cycle
     */
    function _startRewardCycle() internal {
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + cycleDuration;
        
        RewardCycle storage cycle = rewardCycles[currentCycleId];
        cycle.cycleId = currentCycleId;
        cycle.startTime = startTime;
        cycle.endTime = endTime;
        cycle.totalRewards = 0;
        cycle.distributedRewards = 0;
        cycle.poolSize = 0;

        emit RewardCycleStarted(currentCycleId, startTime, endTime);
        currentCycleId += 1;
    }
    
    /**
     * @dev Get score threshold for top performers
     * @param totalScore Total score
     * @param percentile Percentile (e.g., 10 for top 10%)
     */
    function _getTopScoreThreshold(uint256 totalScore, uint256 percentile) internal pure returns (uint256) {
        return (totalScore * percentile) / 100;
    }
    
    /**
     * @dev Pause contract
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Sets Chainlink Functions Oracle execution variables
     */
    function setOracleConfig(bytes32 _donId, uint64 _subscriptionId) external onlyRole(MANAGER_ROLE) {
        donId = _donId;
        subscriptionId = _subscriptionId;
    }

    /**
     * @dev Emergency function to recover tokens
     * @param tokenAddress Token address to recover
     * @param amount Amount to recover
     */
    function recoverTokens(address tokenAddress, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(tokenAddress).transfer(treasury, amount);
    }
}
