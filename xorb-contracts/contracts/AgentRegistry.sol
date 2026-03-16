// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AgentRegistry
 * @dev On-chain agent lifecycle management for Xorb network.
 *
 * Agents are licensed workers in a regulated digital network.
 * They must be spawned by a human sponsor, post a USDC stake bond,
 * receive scoped permissions, and can be paused/revoked/expired.
 *
 * This contract mirrors the client-side AgentRegistry.ts but enforces
 * all rules cryptographically on-chain.
 */
contract AgentRegistry is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // --- Types ---

    enum AgentStatus { Active, Paused, Revoked, Expired }

    enum AgentRole {
        TRADER,
        RESEARCHER,
        MONITOR,
        CODER,
        GOVERNANCE_ASSISTANT,
        FILE_INDEXER,
        RISK_AUDITOR
    }

    struct AgentRecord {
        bytes32 agentId;
        address sponsor;
        string name;
        AgentRole role;
        uint256 stakeBond;          // USDC staked as collateral
        uint256 slashedAmount;      // amount slashed from bond
        bytes32 permissionHash;     // keccak256 of off-chain permission scope JSON
        AgentStatus status;
        uint256 spawnedAt;
        uint256 expiresAt;          // 0 = no expiry
        uint256 reputationScore;    // 0-10000 basis points
        address sessionWallet;      // agent's sub-wallet address
        uint256 totalActions;
        uint256 lastActiveAt;
        string identityCID;         // IPFS CID of full agent identity profile
    }

    // --- Storage ---

    IERC20 public immutable stakeToken;         // USDC token
    address public treasury;                     // receives slashed funds
    address public reputationContract;           // ReputationScore.sol address
    address public slashingContract;             // SlashingEngine.sol address

    uint256 public minStakeBond = 100 * 10**18;  // 100 USDC minimum
    uint256 public maxAgentsPerSponsor = 10;
    uint256 public nextAgentNonce;

    mapping(bytes32 => AgentRecord) public agents;
    mapping(address => bytes32[]) public sponsorAgents;
    mapping(address => uint256) public sponsorActiveCount;
    mapping(bytes32 => bool) public agentExists;

    bytes32[] public allAgentIds;

    // --- Events ---

    event AgentSpawned(
        bytes32 indexed agentId,
        address indexed sponsor,
        string name,
        AgentRole role,
        uint256 stakeBond,
        uint256 expiresAt,
        address sessionWallet
    );
    event AgentPaused(bytes32 indexed agentId, address indexed by);
    event AgentResumed(bytes32 indexed agentId, address indexed by);
    event AgentRevoked(bytes32 indexed agentId, address indexed by, uint256 stakeReturned);
    event AgentExpired(bytes32 indexed agentId);
    event AgentRenewed(bytes32 indexed agentId, uint256 newExpiry);
    event AgentStakeTopUp(bytes32 indexed agentId, uint256 amount);
    event AgentSlashed(bytes32 indexed agentId, uint256 amount);
    event AgentReputationUpdated(bytes32 indexed agentId, uint256 newScore);
    event AgentActionRecorded(bytes32 indexed agentId, uint256 totalActions);
    event AgentIdentityUpdated(bytes32 indexed agentId, string identityCID);
    event ConfigUpdated(string param, uint256 value);

    // --- Errors ---

    error AgentNotFound();
    error AgentNotActive();
    error NotSponsorOrAdmin();
    error MaxAgentsReached();
    error InsufficientStake();
    error AgentNameEmpty();
    error InvalidExpiry();
    error AgentAlreadyActive();
    error OnlySlashingContract();
    error OnlyReputationContract();

    // --- Constructor ---

    constructor(
        address _stakeToken,
        address _treasury,
        address _admin
    ) {
        require(_stakeToken != address(0), "Invalid stake token");
        require(_treasury != address(0), "Invalid treasury");
        require(_admin != address(0), "Invalid admin");

        stakeToken = IERC20(_stakeToken);
        treasury = _treasury;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
    }

    // --- Agent Lifecycle ---

    /**
     * @notice Spawn a new agent. Requires USDC stake bond.
     * @param _name Human-readable agent name
     * @param _role Agent's licensed profession
     * @param _stakeBond Amount of USDC to stake as collateral
     * @param _permissionHash keccak256 of the off-chain permission scope JSON
     * @param _expiresAt Unix timestamp when agent expires (0 = no expiry)
     * @param _sessionWallet Address of the agent's session wallet
     */
    function spawnAgent(
        string calldata _name,
        AgentRole _role,
        uint256 _stakeBond,
        bytes32 _permissionHash,
        uint256 _expiresAt,
        address _sessionWallet
    ) external nonReentrant whenNotPaused returns (bytes32 agentId) {
        if (bytes(_name).length == 0) revert AgentNameEmpty();
        if (_stakeBond < minStakeBond) revert InsufficientStake();
        if (sponsorActiveCount[msg.sender] >= maxAgentsPerSponsor) revert MaxAgentsReached();
        if (_expiresAt != 0 && _expiresAt <= block.timestamp) revert InvalidExpiry();

        // Transfer stake bond from sponsor
        stakeToken.safeTransferFrom(msg.sender, address(this), _stakeBond);

        // Generate unique agent ID
        agentId = keccak256(abi.encodePacked(msg.sender, _name, block.timestamp, nextAgentNonce++));

        agents[agentId] = AgentRecord({
            agentId: agentId,
            sponsor: msg.sender,
            name: _name,
            role: _role,
            stakeBond: _stakeBond,
            slashedAmount: 0,
            permissionHash: _permissionHash,
            status: AgentStatus.Active,
            spawnedAt: block.timestamp,
            expiresAt: _expiresAt,
            reputationScore: 5000, // Start at RELIABLE tier midpoint
            sessionWallet: _sessionWallet,
            totalActions: 0,
            lastActiveAt: block.timestamp,
            identityCID: ""  // Set after profile creation via updateIdentity()
        });

        agentExists[agentId] = true;
        sponsorAgents[msg.sender].push(agentId);
        sponsorActiveCount[msg.sender]++;
        allAgentIds.push(agentId);

        emit AgentSpawned(agentId, msg.sender, _name, _role, _stakeBond, _expiresAt, _sessionWallet);
    }

    /**
     * @notice Pause an active agent. Only sponsor or admin.
     */
    function pauseAgent(bytes32 _agentId) external {
        AgentRecord storage agent = _getActiveAgent(_agentId);
        _requireSponsorOrAdmin(agent.sponsor);

        agent.status = AgentStatus.Paused;
        sponsorActiveCount[agent.sponsor]--;

        emit AgentPaused(_agentId, msg.sender);
    }

    /**
     * @notice Resume a paused agent. Only sponsor or admin.
     */
    function resumeAgent(bytes32 _agentId) external {
        AgentRecord storage agent = _getAgent(_agentId);
        if (agent.status != AgentStatus.Paused) revert AgentNotActive();
        _requireSponsorOrAdmin(agent.sponsor);

        // Check if expired while paused
        if (agent.expiresAt != 0 && block.timestamp >= agent.expiresAt) {
            agent.status = AgentStatus.Expired;
            emit AgentExpired(_agentId);
            return;
        }

        agent.status = AgentStatus.Active;
        sponsorActiveCount[agent.sponsor]++;

        emit AgentResumed(_agentId, msg.sender);
    }

    /**
     * @notice Revoke an agent permanently. Returns remaining stake to sponsor.
     */
    function revokeAgent(bytes32 _agentId) external nonReentrant {
        AgentRecord storage agent = _getAgent(_agentId);
        if (agent.status == AgentStatus.Revoked) revert AgentNotActive();
        _requireSponsorOrAdmin(agent.sponsor);

        if (agent.status == AgentStatus.Active) {
            sponsorActiveCount[agent.sponsor]--;
        }

        agent.status = AgentStatus.Revoked;

        // Return remaining stake (bond minus slashed amount)
        uint256 remainingStake = agent.stakeBond - agent.slashedAmount;
        if (remainingStake > 0) {
            stakeToken.safeTransfer(agent.sponsor, remainingStake);
        }

        emit AgentRevoked(_agentId, msg.sender, remainingStake);
    }

    /**
     * @notice Extend an agent's expiry. Only sponsor.
     */
    function renewAgent(bytes32 _agentId, uint256 _newExpiry) external {
        AgentRecord storage agent = _getAgent(_agentId);
        if (agent.status == AgentStatus.Revoked) revert AgentNotActive();
        _requireSponsorOrAdmin(agent.sponsor);
        if (_newExpiry != 0 && _newExpiry <= block.timestamp) revert InvalidExpiry();

        // If it was expired, reactivate
        if (agent.status == AgentStatus.Expired) {
            agent.status = AgentStatus.Active;
            sponsorActiveCount[agent.sponsor]++;
        }

        agent.expiresAt = _newExpiry;

        emit AgentRenewed(_agentId, _newExpiry);
    }

    /**
     * @notice Top up an agent's stake bond.
     */
    function topUpStake(bytes32 _agentId, uint256 _amount) external nonReentrant {
        AgentRecord storage agent = _getAgent(_agentId);
        require(_amount > 0, "Amount must be > 0");

        stakeToken.safeTransferFrom(msg.sender, address(this), _amount);
        agent.stakeBond += _amount;

        emit AgentStakeTopUp(_agentId, _amount);
    }

    // --- Called by SlashingEngine ---

    /**
     * @notice Slash an agent's stake. Only callable by the SlashingEngine contract.
     * @param _agentId The agent to slash
     * @param _amount Amount of USDC to slash
     * @param _autoRevoke Whether to auto-revoke the agent
     */
    function slashAgent(bytes32 _agentId, uint256 _amount, bool _autoRevoke) external nonReentrant {
        if (msg.sender != slashingContract) revert OnlySlashingContract();

        AgentRecord storage agent = _getAgent(_agentId);

        uint256 remainingBond = agent.stakeBond - agent.slashedAmount;
        uint256 actualSlash = _amount > remainingBond ? remainingBond : _amount;

        agent.slashedAmount += actualSlash;

        // Transfer slashed funds to treasury
        if (actualSlash > 0) {
            stakeToken.safeTransfer(treasury, actualSlash);
        }

        emit AgentSlashed(_agentId, actualSlash);

        // Auto-revoke on critical violations
        if (_autoRevoke) {
            if (agent.status == AgentStatus.Active) {
                sponsorActiveCount[agent.sponsor]--;
            }
            agent.status = AgentStatus.Revoked;

            uint256 returnStake = agent.stakeBond - agent.slashedAmount;
            if (returnStake > 0) {
                stakeToken.safeTransfer(agent.sponsor, returnStake);
            }
            emit AgentRevoked(_agentId, msg.sender, returnStake);
        }
    }

    // --- Called by ReputationScore ---

    /**
     * @notice Update an agent's reputation score. Only callable by ReputationScore contract.
     */
    function updateReputation(bytes32 _agentId, uint256 _newScore) external {
        if (msg.sender != reputationContract) revert OnlyReputationContract();

        AgentRecord storage agent = _getAgent(_agentId);
        agent.reputationScore = _newScore > 10000 ? 10000 : _newScore;

        // Auto-pause if reputation drops below 500
        if (agent.reputationScore < 500 && agent.status == AgentStatus.Active) {
            agent.status = AgentStatus.Paused;
            sponsorActiveCount[agent.sponsor]--;
            emit AgentPaused(_agentId, address(this));
        }

        emit AgentReputationUpdated(_agentId, agent.reputationScore);
    }

    // --- Called by Operator (backend oracle) ---

    /**
     * @notice Record an agent action. Called by the off-chain runtime oracle.
     */
    function recordAction(bytes32 _agentId) external onlyRole(OPERATOR_ROLE) {
        AgentRecord storage agent = _getAgent(_agentId);

        // Check expiry
        if (agent.expiresAt != 0 && block.timestamp >= agent.expiresAt && agent.status == AgentStatus.Active) {
            agent.status = AgentStatus.Expired;
            sponsorActiveCount[agent.sponsor]--;
            emit AgentExpired(_agentId);
            return;
        }

        agent.totalActions++;
        agent.lastActiveAt = block.timestamp;

        emit AgentActionRecorded(_agentId, agent.totalActions);
    }

    // --- View Functions ---

    function getAgent(bytes32 _agentId) external view returns (AgentRecord memory) {
        if (!agentExists[_agentId]) revert AgentNotFound();
        return agents[_agentId];
    }

    function isActive(bytes32 _agentId) external view returns (bool) {
        if (!agentExists[_agentId]) return false;
        AgentRecord storage agent = agents[_agentId];
        if (agent.status != AgentStatus.Active) return false;
        if (agent.expiresAt != 0 && block.timestamp >= agent.expiresAt) return false;
        return true;
    }

    function getSponsorAgents(address _sponsor) external view returns (bytes32[] memory) {
        return sponsorAgents[_sponsor];
    }

    function getSponsorActiveCount(address _sponsor) external view returns (uint256) {
        return sponsorActiveCount[_sponsor];
    }

    function getTotalAgents() external view returns (uint256) {
        return allAgentIds.length;
    }

    /**
     * @notice Update the off-chain identity profile CID. Only sponsor or operator.
     * @param _agentId The agent to update
     * @param _identityCID IPFS CID of the full agent identity profile JSON
     */
    function updateIdentity(bytes32 _agentId, string calldata _identityCID) external {
        AgentRecord storage agent = _getAgent(_agentId);
        if (msg.sender != agent.sponsor && !hasRole(OPERATOR_ROLE, msg.sender)) {
            revert NotSponsorOrAdmin();
        }
        agent.identityCID = _identityCID;
        emit AgentIdentityUpdated(_agentId, _identityCID);
    }

    function getIdentityCID(bytes32 _agentId) external view returns (string memory) {
        if (!agentExists[_agentId]) revert AgentNotFound();
        return agents[_agentId].identityCID;
    }

    function getReputationTier(bytes32 _agentId) external view returns (string memory) {
        if (!agentExists[_agentId]) revert AgentNotFound();
        uint256 score = agents[_agentId].reputationScore;
        if (score < 1000) return "UNTRUSTED";
        if (score < 3000) return "NOVICE";
        if (score < 6000) return "RELIABLE";
        if (score < 8500) return "TRUSTED";
        return "ELITE";
    }

    // --- Admin Functions ---

    function setReputationContract(address _addr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_addr != address(0), "Invalid address");
        reputationContract = _addr;
    }

    function setSlashingContract(address _addr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_addr != address(0), "Invalid address");
        slashingContract = _addr;
    }

    function setTreasury(address _addr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_addr != address(0), "Invalid address");
        treasury = _addr;
    }

    function setMinStakeBond(uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minStakeBond = _amount;
        emit ConfigUpdated("minStakeBond", _amount);
    }

    function setMaxAgentsPerSponsor(uint256 _max) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_max > 0, "Must allow at least 1");
        maxAgentsPerSponsor = _max;
        emit ConfigUpdated("maxAgentsPerSponsor", _max);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // --- Internal Helpers ---

    function _getAgent(bytes32 _agentId) internal view returns (AgentRecord storage) {
        if (!agentExists[_agentId]) revert AgentNotFound();
        return agents[_agentId];
    }

    function _getActiveAgent(bytes32 _agentId) internal view returns (AgentRecord storage) {
        AgentRecord storage agent = _getAgent(_agentId);
        if (agent.status != AgentStatus.Active) revert AgentNotActive();
        return agent;
    }

    function _requireSponsorOrAdmin(address _sponsor) internal view {
        if (msg.sender != _sponsor && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotSponsorOrAdmin();
        }
    }
}
