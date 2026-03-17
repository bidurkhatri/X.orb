// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ReputationScore
 * @dev Non-transferable on-chain reputation for agents in the Xorb network.
 *
 * Reputation is Soulbound — it cannot be bought, sold, or transferred.
 * It determines an agent's trust tier and affects what they can do:
 *   - UNTRUSTED (0-999): Severely restricted, likely auto-paused
 *   - NOVICE (1000-2999): Basic operations only
 *   - RELIABLE (3000-5999): Standard operations
 *   - TRUSTED (6000-8499): Elevated privileges
 *   - ELITE (8500-10000): Maximum trust, highest capabilities
 *
 * Only authorized oracles (the agent runtime backend) can update scores.
 * The contract calls AgentRegistry.updateReputation() to enforce auto-pause
 * when reputation drops below threshold.
 *
 * Mirrors the reputation system in AgentRuntime.ts:
 *   +1 per successful tool execution
 *   +5 per successful task completion
 *   -5 per failed tool
 *   -10 per failed task
 *   -50 per rate limit violation
 *   -100 per permission violation
 */
import "./interfaces/IReputationFeedback.sol";

contract ReputationScore is AccessControl, ReentrancyGuard, Pausable, IReputationFeedback {

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant FEEDBACK_ROLE = keccak256("FEEDBACK_ROLE");

    // --- Types ---

    enum Tier { UNTRUSTED, NOVICE, RELIABLE, TRUSTED, ELITE }

    enum ActionType {
        TOOL_SUCCESS,           // +1
        TASK_COMPLETION,        // +5
        TOOL_FAILURE,           // -5
        TASK_FAILURE,           // -10
        RATE_LIMIT_VIOLATION,   // -50
        PERMISSION_VIOLATION    // -100
    }

    struct ReputationRecord {
        uint256 score;              // 0-10000 basis points
        uint256 totalPositive;      // lifetime positive actions
        uint256 totalNegative;      // lifetime negative actions
        uint256 lastUpdatedAt;
        uint256 lastDecayAt;        // last time decay was applied
    }

    struct ActionLog {
        bytes32 agentId;
        ActionType actionType;
        int256 delta;
        uint256 scoreBefore;
        uint256 scoreAfter;
        string reason;
        uint256 timestamp;
    }

    // --- Storage ---

    /// @dev Interface to call AgentRegistry.updateReputation()
    IAgentRegistry public agentRegistry;

    /// @dev Reputation per agentId
    mapping(bytes32 => ReputationRecord) public reputations;

    /// @dev Action history per agentId (last N actions)
    mapping(bytes32 => ActionLog[]) public actionHistory;

    /// @dev Maximum action history kept per agent
    uint256 public maxHistoryPerAgent = 100;

    /// @dev Default starting score for new agents
    uint256 public constant DEFAULT_SCORE = 5000;

    /// @dev Auto-pause threshold (aligns with NOVICE tier lower bound)
    uint256 public constant PAUSE_THRESHOLD = 1000;

    /// @dev Max score
    uint256 public constant MAX_SCORE = 10000;

    /// @dev Decay amount per day of inactivity
    uint256 public decayPerDay = 1;

    /// @dev Decay grace period (no decay within this window)
    uint256 public decayGracePeriod = 7 days;

    /// @dev Delta values for each action type
    mapping(ActionType => int256) public actionDeltas;

    // --- Events ---

    event ReputationUpdated(
        bytes32 indexed agentId,
        ActionType actionType,
        int256 delta,
        uint256 newScore,
        string reason
    );
    event ReputationInitialized(bytes32 indexed agentId, uint256 initialScore);
    event DecayApplied(bytes32 indexed agentId, uint256 decayAmount, uint256 newScore);

    // --- Constructor ---

    constructor(address _agentRegistry, address _admin) {
        require(_agentRegistry != address(0), "Invalid registry");
        require(_admin != address(0), "Invalid admin");

        agentRegistry = IAgentRegistry(_agentRegistry);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ORACLE_ROLE, _admin);

        // Set default deltas (matching AgentRuntime.ts)
        actionDeltas[ActionType.TOOL_SUCCESS] = 1;
        actionDeltas[ActionType.TASK_COMPLETION] = 5;
        actionDeltas[ActionType.TOOL_FAILURE] = -5;
        actionDeltas[ActionType.TASK_FAILURE] = -10;
        actionDeltas[ActionType.RATE_LIMIT_VIOLATION] = -50;
        actionDeltas[ActionType.PERMISSION_VIOLATION] = -100;
    }

    // --- Core Functions ---

    /**
     * @notice Initialize reputation for a newly spawned agent.
     * @dev Called by AgentRegistry after spawning, or by oracle on first interaction.
     */
    function initializeReputation(bytes32 _agentId) external onlyRole(ORACLE_ROLE) {
        require(reputations[_agentId].lastUpdatedAt == 0, "Already initialized");

        reputations[_agentId] = ReputationRecord({
            score: DEFAULT_SCORE,
            totalPositive: 0,
            totalNegative: 0,
            lastUpdatedAt: block.timestamp,
            lastDecayAt: block.timestamp
        });

        emit ReputationInitialized(_agentId, DEFAULT_SCORE);
    }

    /**
     * @notice Record an action that affects reputation.
     * @param _agentId The agent whose reputation changes
     * @param _actionType The type of action (determines delta)
     * @param _reason Human-readable reason for the action
     */
    function recordAction(
        bytes32 _agentId,
        ActionType _actionType,
        string calldata _reason
    ) external onlyRole(ORACLE_ROLE) whenNotPaused {
        ReputationRecord storage rep = reputations[_agentId];
        require(rep.lastUpdatedAt > 0, "Agent reputation not initialized");

        // Apply decay first if applicable
        _applyDecay(_agentId);

        int256 delta = actionDeltas[_actionType];
        uint256 scoreBefore = rep.score;
        uint256 scoreAfter;

        if (delta >= 0) {
            // Positive action
            uint256 positiveDelta = uint256(delta);
            scoreAfter = rep.score + positiveDelta;
            if (scoreAfter > MAX_SCORE) scoreAfter = MAX_SCORE;
            rep.totalPositive++;
        } else {
            // Negative action
            uint256 negativeDelta = uint256(-delta);
            if (negativeDelta >= rep.score) {
                scoreAfter = 0;
            } else {
                scoreAfter = rep.score - negativeDelta;
            }
            rep.totalNegative++;
        }

        rep.score = scoreAfter;
        rep.lastUpdatedAt = block.timestamp;

        // Store action in history (circular buffer)
        ActionLog memory log = ActionLog({
            agentId: _agentId,
            actionType: _actionType,
            delta: delta,
            scoreBefore: scoreBefore,
            scoreAfter: scoreAfter,
            reason: _reason,
            timestamp: block.timestamp
        });

        if (actionHistory[_agentId].length < maxHistoryPerAgent) {
            actionHistory[_agentId].push(log);
        } else {
            // Overwrite oldest entry
            uint256 idx = actionHistory[_agentId].length % maxHistoryPerAgent;
            actionHistory[_agentId][idx] = log;
        }

        // Notify AgentRegistry of new score (triggers auto-pause if below threshold)
        agentRegistry.updateReputation(_agentId, scoreAfter);

        emit ReputationUpdated(_agentId, _actionType, delta, scoreAfter, _reason);
    }

    /**
     * @notice Apply a custom reputation delta (for special cases like slashing).
     */
    function applyCustomDelta(
        bytes32 _agentId,
        int256 _delta,
        string calldata _reason
    ) external onlyRole(ORACLE_ROLE) whenNotPaused {
        ReputationRecord storage rep = reputations[_agentId];
        require(rep.lastUpdatedAt > 0, "Agent reputation not initialized");

        uint256 scoreBefore = rep.score;
        uint256 scoreAfter;

        if (_delta >= 0) {
            scoreAfter = rep.score + uint256(_delta);
            if (scoreAfter > MAX_SCORE) scoreAfter = MAX_SCORE;
        } else {
            uint256 absDelta = uint256(-_delta);
            scoreAfter = absDelta >= rep.score ? 0 : rep.score - absDelta;
        }

        rep.score = scoreAfter;
        rep.lastUpdatedAt = block.timestamp;

        agentRegistry.updateReputation(_agentId, scoreAfter);

        emit ReputationUpdated(
            _agentId,
            ActionType.TOOL_SUCCESS, // placeholder type for custom
            _delta,
            scoreAfter,
            _reason
        );
    }

    /**
     * @notice Manually trigger decay for an agent. Anyone can call.
     */
    function triggerDecay(bytes32 _agentId) external {
        _applyDecay(_agentId);
    }

    // --- View Functions ---

    function getReputation(bytes32 _agentId) external view returns (uint256) {
        return reputations[_agentId].score;
    }

    function getReputationRecord(bytes32 _agentId) external view returns (ReputationRecord memory) {
        return reputations[_agentId];
    }

    function getTier(bytes32 _agentId) external view returns (Tier) {
        uint256 score = reputations[_agentId].score;
        if (score < 1000) return Tier.UNTRUSTED;
        if (score < 3000) return Tier.NOVICE;
        if (score < 6000) return Tier.RELIABLE;
        if (score < 8500) return Tier.TRUSTED;
        return Tier.ELITE;
    }

    function getActionHistory(bytes32 _agentId) external view returns (ActionLog[] memory) {
        return actionHistory[_agentId];
    }

    function getActionHistoryLength(bytes32 _agentId) external view returns (uint256) {
        return actionHistory[_agentId].length;
    }

    // --- Admin Functions ---

    function setActionDelta(ActionType _actionType, int256 _delta) external onlyRole(DEFAULT_ADMIN_ROLE) {
        actionDeltas[_actionType] = _delta;
    }

    function setDecayPerDay(uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        decayPerDay = _amount;
    }

    function setDecayGracePeriod(uint256 _period) external onlyRole(DEFAULT_ADMIN_ROLE) {
        decayGracePeriod = _period;
    }

    function setMaxHistoryPerAgent(uint256 _max) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxHistoryPerAgent = _max;
    }

    function setAgentRegistry(address _addr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_addr != address(0), "Invalid address");
        agentRegistry = IAgentRegistry(_addr);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // --- Internal ---

    function _applyDecay(bytes32 _agentId) internal {
        ReputationRecord storage rep = reputations[_agentId];
        if (rep.lastUpdatedAt == 0) return;
        if (decayPerDay == 0) return;

        uint256 timeSinceLastActive = block.timestamp - rep.lastUpdatedAt;
        if (timeSinceLastActive <= decayGracePeriod) return;

        uint256 decayableDays = (timeSinceLastActive - decayGracePeriod) / 1 days;
        uint256 lastDecayDays = 0;

        if (rep.lastDecayAt > rep.lastUpdatedAt) {
            // Decay already partially applied
            uint256 alreadyDecayed = (rep.lastDecayAt - rep.lastUpdatedAt);
            if (alreadyDecayed > decayGracePeriod) {
                lastDecayDays = (alreadyDecayed - decayGracePeriod) / 1 days;
            }
        }

        uint256 newDecayDays = decayableDays > lastDecayDays ? decayableDays - lastDecayDays : 0;
        if (newDecayDays == 0) return;

        uint256 totalDecay = newDecayDays * decayPerDay;
        uint256 newScore = totalDecay >= rep.score ? 0 : rep.score - totalDecay;

        rep.score = newScore;
        rep.lastDecayAt = block.timestamp;

        agentRegistry.updateReputation(_agentId, newScore);

        emit DecayApplied(_agentId, totalDecay, newScore);
    }

    // ═══════════════════════════════════════════
    // ═══  ERC-8004: IReputationFeedback  ════
    // ═══════════════════════════════════════════

    /// @dev Feedback records per agent
    mapping(bytes32 => Feedback[]) private agentFeedback;

    /// @dev Feedback summary per agent
    mapping(bytes32 => uint256) public totalFeedbackCount;
    mapping(bytes32 => uint256) public positiveFeedbackCount;
    mapping(bytes32 => uint256) public negativeFeedbackCount;

    /// @inheritdoc IReputationFeedback
    function submitFeedback(
        bytes32 fromAgent,
        bytes32 toAgent,
        uint256 score,
        string[] calldata tags,
        string calldata context
    ) external override {
        require(score <= 100, "Score must be 0-100");
        require(reputations[toAgent].lastUpdatedAt > 0, "Target agent not registered");

        Feedback memory fb = Feedback({
            fromAgent: fromAgent,
            toAgent: toAgent,
            score: score,
            tags: tags,
            context: context,
            timestamp: block.timestamp
        });

        agentFeedback[toAgent].push(fb);
        totalFeedbackCount[toAgent]++;

        if (score >= 50) {
            positiveFeedbackCount[toAgent]++;
        } else {
            negativeFeedbackCount[toAgent]++;
        }

        // Apply reputation impact: feedback score maps to -10..+10 delta
        int256 delta = int256(score) - 50; // 0→-50, 50→0, 100→+50
        delta = delta / 5; // scale to -10..+10

        if (delta != 0) {
            ReputationRecord storage rep = reputations[toAgent];
            uint256 scoreBefore = rep.score;
            uint256 scoreAfter;

            if (delta >= 0) {
                scoreAfter = rep.score + uint256(delta);
                if (scoreAfter > MAX_SCORE) scoreAfter = MAX_SCORE;
            } else {
                uint256 absDelta = uint256(-delta);
                scoreAfter = absDelta >= rep.score ? 0 : rep.score - absDelta;
            }

            rep.score = scoreAfter;
            rep.lastUpdatedAt = block.timestamp;
            agentRegistry.updateReputation(toAgent, scoreAfter);
        }

        emit FeedbackSubmitted(fromAgent, toAgent, score, block.timestamp);
    }

    /// @inheritdoc IReputationFeedback
    function getReputation(bytes32 agentId) external view override returns (
        uint256 score,
        uint256 totalFeedback,
        uint256 positiveFeedback,
        uint256 negativeFeedback
    ) {
        return (
            reputations[agentId].score,
            totalFeedbackCount[agentId],
            positiveFeedbackCount[agentId],
            negativeFeedbackCount[agentId]
        );
    }

    /// @inheritdoc IReputationFeedback
    function getFeedback(bytes32 agentId, uint256 offset, uint256 limit)
        external view override returns (Feedback[] memory)
    {
        Feedback[] storage all = agentFeedback[agentId];
        if (offset >= all.length) return new Feedback[](0);

        uint256 end = offset + limit;
        if (end > all.length) end = all.length;
        uint256 size = end - offset;

        Feedback[] memory result = new Feedback[](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = all[offset + i];
        }
        return result;
    }

    /// @inheritdoc IReputationFeedback
    function supportsERC8004() external pure override returns (bool) {
        return true;
    }
}

// --- Interface ---

interface IAgentRegistry {
    function updateReputation(bytes32 agentId, uint256 newScore) external;
}
