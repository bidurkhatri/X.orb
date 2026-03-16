// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title SlashingEngine
 * @dev Automated penalty enforcement for the Xorb agent network.
 *
 * When an agent misbehaves (exceeds rate limits, violates permissions,
 * misuses funds, or causes critical faults), this contract:
 *   1. Records the violation
 *   2. Calculates the slash amount based on violation type
 *   3. Calls AgentRegistry.slashAgent() to deduct from stake
 *   4. Calls ReputationScore to reduce reputation
 *   5. Auto-revokes on critical violations
 *
 * Violation Types and Penalties:
 *   RATE_LIMIT_EXCEEDED:  5% of remaining stake
 *   PERMISSION_VIOLATION: 10% of remaining stake
 *   FUND_MISUSE:          25% of remaining stake
 *   CRITICAL_FAULT:       50% of remaining stake + auto-revoke
 *
 * Only authorized reporters (agent runtime oracle, governance) can report violations.
 */
contract SlashingEngine is AccessControl, ReentrancyGuard, Pausable {

    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

    // --- Types ---

    enum ViolationType {
        RATE_LIMIT_EXCEEDED,    // 5% slash
        PERMISSION_VIOLATION,   // 10% slash
        FUND_MISUSE,            // 25% slash
        CRITICAL_FAULT          // 50% slash + auto-revoke
    }

    struct SlashRecord {
        bytes32 agentId;
        ViolationType violationType;
        uint256 slashAmount;
        uint256 reputationPenalty;
        string evidence;            // IPFS CID or description
        address reporter;
        uint256 timestamp;
        bool executed;
    }

    struct SlashConfig {
        uint256 stakePercentBps;    // basis points (500 = 5%)
        int256 reputationDelta;     // negative value
        bool autoRevoke;            // whether to auto-revoke agent
    }

    // --- Storage ---

    IAgentRegistrySlash public agentRegistry;
    IReputationScoreSlash public reputationScore;

    /// @dev All slash records
    SlashRecord[] public slashRecords;

    /// @dev Slash records per agent
    mapping(bytes32 => uint256[]) public agentSlashRecordIds;

    /// @dev Configuration per violation type
    mapping(ViolationType => SlashConfig) public slashConfigs;

    /// @dev Cooldown per agent (prevent spam slashing)
    mapping(bytes32 => uint256) public lastSlashTime;
    uint256 public slashCooldown = 1 hours;

    /// @dev Total slashed across all agents
    uint256 public totalSlashed;

    /// @dev Total violations recorded
    uint256 public totalViolations;

    // --- Events ---

    event ViolationReported(
        uint256 indexed recordId,
        bytes32 indexed agentId,
        ViolationType violationType,
        address reporter,
        string evidence
    );
    event SlashExecuted(
        uint256 indexed recordId,
        bytes32 indexed agentId,
        uint256 slashAmount,
        int256 reputationDelta,
        bool autoRevoked
    );
    event SlashConfigUpdated(ViolationType violationType, uint256 stakePercentBps, int256 reputationDelta, bool autoRevoke);

    // --- Errors ---

    error AgentOnCooldown();
    error RecordAlreadyExecuted();
    error InvalidRecordId();

    // --- Constructor ---

    constructor(
        address _agentRegistry,
        address _reputationScore,
        address _admin
    ) {
        require(_agentRegistry != address(0), "Invalid registry");
        require(_reputationScore != address(0), "Invalid reputation");
        require(_admin != address(0), "Invalid admin");

        agentRegistry = IAgentRegistrySlash(_agentRegistry);
        reputationScore = IReputationScoreSlash(_reputationScore);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(REPORTER_ROLE, _admin);
        _grantRole(GOVERNOR_ROLE, _admin);

        // Default slash configurations
        slashConfigs[ViolationType.RATE_LIMIT_EXCEEDED] = SlashConfig({
            stakePercentBps: 500,       // 5%
            reputationDelta: -50,
            autoRevoke: false
        });
        slashConfigs[ViolationType.PERMISSION_VIOLATION] = SlashConfig({
            stakePercentBps: 1000,      // 10%
            reputationDelta: -100,
            autoRevoke: false
        });
        slashConfigs[ViolationType.FUND_MISUSE] = SlashConfig({
            stakePercentBps: 2500,      // 25%
            reputationDelta: -500,
            autoRevoke: false
        });
        slashConfigs[ViolationType.CRITICAL_FAULT] = SlashConfig({
            stakePercentBps: 5000,      // 50%
            reputationDelta: -2000,
            autoRevoke: true
        });
    }

    // --- Core Functions ---

    /**
     * @notice Report a violation and immediately execute the slash.
     * @param _agentId The agent that violated rules
     * @param _violationType The type of violation
     * @param _evidence IPFS CID or description of evidence
     */
    function reportAndSlash(
        bytes32 _agentId,
        ViolationType _violationType,
        string calldata _evidence
    ) external onlyRole(REPORTER_ROLE) nonReentrant whenNotPaused {
        // Check cooldown
        if (block.timestamp - lastSlashTime[_agentId] < slashCooldown) {
            revert AgentOnCooldown();
        }

        SlashConfig memory config = slashConfigs[_violationType];

        // Get agent's current stake from registry
        IAgentRegistrySlash.AgentRecord memory agent = agentRegistry.getAgent(_agentId);
        uint256 remainingStake = agent.stakeBond - agent.slashedAmount;
        uint256 slashAmount = (remainingStake * config.stakePercentBps) / 10000;

        // Create record
        uint256 recordId = slashRecords.length;
        slashRecords.push(SlashRecord({
            agentId: _agentId,
            violationType: _violationType,
            slashAmount: slashAmount,
            reputationPenalty: uint256(-config.reputationDelta),
            evidence: _evidence,
            reporter: msg.sender,
            timestamp: block.timestamp,
            executed: true
        }));

        agentSlashRecordIds[_agentId].push(recordId);
        lastSlashTime[_agentId] = block.timestamp;
        totalSlashed += slashAmount;
        totalViolations++;

        emit ViolationReported(recordId, _agentId, _violationType, msg.sender, _evidence);

        // Execute slash on AgentRegistry
        if (slashAmount > 0) {
            agentRegistry.slashAgent(_agentId, slashAmount, config.autoRevoke);
        }

        // Apply reputation penalty
        reputationScore.applyCustomDelta(
            _agentId,
            config.reputationDelta,
            string(abi.encodePacked("Slashing: ", _evidence))
        );

        emit SlashExecuted(recordId, _agentId, slashAmount, config.reputationDelta, config.autoRevoke);
    }

    /**
     * @notice Report a violation without immediate execution (for governance review).
     */
    function reportViolation(
        bytes32 _agentId,
        ViolationType _violationType,
        string calldata _evidence
    ) external onlyRole(REPORTER_ROLE) whenNotPaused returns (uint256 recordId) {
        SlashConfig memory config = slashConfigs[_violationType];

        IAgentRegistrySlash.AgentRecord memory agent = agentRegistry.getAgent(_agentId);
        uint256 remainingStake = agent.stakeBond - agent.slashedAmount;
        uint256 slashAmount = (remainingStake * config.stakePercentBps) / 10000;

        recordId = slashRecords.length;
        slashRecords.push(SlashRecord({
            agentId: _agentId,
            violationType: _violationType,
            slashAmount: slashAmount,
            reputationPenalty: uint256(-config.reputationDelta),
            evidence: _evidence,
            reporter: msg.sender,
            timestamp: block.timestamp,
            executed: false
        }));

        agentSlashRecordIds[_agentId].push(recordId);
        totalViolations++;

        emit ViolationReported(recordId, _agentId, _violationType, msg.sender, _evidence);
    }

    /**
     * @notice Execute a previously reported violation. Governor role only.
     */
    function executeSlash(uint256 _recordId) external onlyRole(GOVERNOR_ROLE) nonReentrant whenNotPaused {
        if (_recordId >= slashRecords.length) revert InvalidRecordId();

        SlashRecord storage record = slashRecords[_recordId];
        if (record.executed) revert RecordAlreadyExecuted();

        record.executed = true;
        lastSlashTime[record.agentId] = block.timestamp;
        totalSlashed += record.slashAmount;

        SlashConfig memory config = slashConfigs[record.violationType];

        // Execute slash
        if (record.slashAmount > 0) {
            agentRegistry.slashAgent(record.agentId, record.slashAmount, config.autoRevoke);
        }

        // Apply reputation penalty
        reputationScore.applyCustomDelta(
            record.agentId,
            config.reputationDelta,
            string(abi.encodePacked("Governance slash: ", record.evidence))
        );

        emit SlashExecuted(
            _recordId,
            record.agentId,
            record.slashAmount,
            config.reputationDelta,
            config.autoRevoke
        );
    }

    // --- View Functions ---

    function getSlashRecord(uint256 _recordId) external view returns (SlashRecord memory) {
        if (_recordId >= slashRecords.length) revert InvalidRecordId();
        return slashRecords[_recordId];
    }

    function getAgentSlashRecords(bytes32 _agentId) external view returns (uint256[] memory) {
        return agentSlashRecordIds[_agentId];
    }

    function getAgentSlashCount(bytes32 _agentId) external view returns (uint256) {
        return agentSlashRecordIds[_agentId].length;
    }

    function getTotalRecords() external view returns (uint256) {
        return slashRecords.length;
    }

    function getPendingSlashes() external view returns (uint256 count) {
        for (uint256 i = 0; i < slashRecords.length; i++) {
            if (!slashRecords[i].executed) count++;
        }
    }

    // --- Admin Functions ---

    function updateSlashConfig(
        ViolationType _violationType,
        uint256 _stakePercentBps,
        int256 _reputationDelta,
        bool _autoRevoke
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_stakePercentBps <= 10000, "Percent cannot exceed 100%");
        require(_reputationDelta <= 0, "Reputation delta must be negative or zero");

        slashConfigs[_violationType] = SlashConfig({
            stakePercentBps: _stakePercentBps,
            reputationDelta: _reputationDelta,
            autoRevoke: _autoRevoke
        });

        emit SlashConfigUpdated(_violationType, _stakePercentBps, _reputationDelta, _autoRevoke);
    }

    function setSlashCooldown(uint256 _cooldown) external onlyRole(DEFAULT_ADMIN_ROLE) {
        slashCooldown = _cooldown;
    }

    function setAgentRegistry(address _addr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_addr != address(0), "Invalid address");
        agentRegistry = IAgentRegistrySlash(_addr);
    }

    function setReputationScore(address _addr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_addr != address(0), "Invalid address");
        reputationScore = IReputationScoreSlash(_addr);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}

// --- Interfaces ---

interface IAgentRegistrySlash {
    struct AgentRecord {
        bytes32 agentId;
        address sponsor;
        string name;
        uint8 role;
        uint256 stakeBond;
        uint256 slashedAmount;
        bytes32 permissionHash;
        uint8 status;
        uint256 spawnedAt;
        uint256 expiresAt;
        uint256 reputationScore;
        address sessionWallet;
        uint256 totalActions;
        uint256 lastActiveAt;
        string identityCID;
    }

    function getAgent(bytes32 agentId) external view returns (AgentRecord memory);
    function slashAgent(bytes32 agentId, uint256 amount, bool autoRevoke) external;
}

interface IReputationScoreSlash {
    function applyCustomDelta(bytes32 agentId, int256 delta, string calldata reason) external;
}
