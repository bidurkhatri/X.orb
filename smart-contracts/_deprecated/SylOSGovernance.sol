// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SylOSGovernance
 * @dev DAO governance contract for SylOS ecosystem
 * Features:
 * - Proposal creation and voting
 * - Quorum and threshold requirements
 * - Timelock for proposal execution
 * - Delegation system
 * - Multi-level governance structure
 * - Emergency controls
 */
contract SylOSGovernance is AccessControl, ReentrancyGuard, Pausable {

    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    bytes32 public constant TIMELOCK_ADMIN_ROLE = keccak256("TIMELOCK_ADMIN_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    // Governance structure
    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string description;
        string[] actions; // Array of action descriptions
        address[] targets; // Array of target addresses
        uint256[] values; // Array of ETH values
        bytes[] calldatas; // Array of function calls
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool executed;
        bool canceled;
        mapping(address => bool) hasVoted;
        mapping(address => uint8) votes; // 0=abstain, 1=against, 2=for
        string evidence; // IPFS hash of proposal evidence
    }

    struct DelegateInfo {
        address delegatee;
        uint256 delegatedVotes;
        bool isActive;
        uint256 lastUpdate;
    }

    struct GovernanceSettings {
        uint256 votingDelay; // blocks
        uint256 votingPeriod; // blocks
        uint256 proposalThreshold; // minimum votes required to propose
        uint256 quorumThreshold; // minimum votes required for quorum
        uint256 emergencyThreshold; // threshold for emergency actions
        uint256 minExecutionDelay; // minimum delay before execution
    }

    struct TimelockOperation {
        bytes32 id;
        address target;
        uint256 value;
        bytes data;
        uint256 eta;
        bool executed;
        bool canceled;
    }

    // Storage
    mapping(uint256 => Proposal) public proposals;
    mapping(address => mapping(address => uint256)) public userVotes;
    mapping(address => DelegateInfo) public delegates;
    mapping(address => bool) public governors;
    mapping(bytes32 => TimelockOperation) public timelockOperations;
    mapping(address => uint256) public lockedFunds; // Locked SYLOS tokens
    mapping(address => uint256) public proposalCreatedByUser;

    GovernanceSettings public settings;
    IERC20 public votingToken;
    address public timelock;
    address public treasury;
    uint256 public proposalCount = 0;
    uint256 public totalDelegatedVotes = 0;
    uint256 public minLockedAmount = 1000 * 10**18; // Minimum 1000 SYLOS to participate

    // Constants
    uint256 public constant MAX_VOTING_DELAY = 172800; // ~30 days in blocks (3 sec/block)
    uint256 public constant MAX_VOTING_PERIOD = 57600; // ~10 days in blocks
    uint256 public constant MAX_PROPOSAL_THRESHOLD = 100000 * 10**18; // 100K SYLOS max
    uint256 public constant MIN_PROPOSAL_THRESHOLD = 100 * 10**18; // 100 SYLOS min

    // Events
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string title,
        string description,
        address[] targets,
        uint256[] values,
        string evidence
    );
    event Voted(
        address indexed voter,
        uint256 indexed proposalId,
        uint8 support,
        uint256 weight,
        string reason
    );
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event DelegatedVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance);
    event TimelockOperationQueued(bytes32 indexed id, address indexed target, uint256 value, bytes data, uint256 eta);
    event TimelockOperationExecuted(bytes32 indexed id);
    event TimelockOperationCanceled(bytes32 indexed id);
    event SettingsUpdated(
        uint256 votingDelay,
        uint256 votingPeriod,
        uint256 proposalThreshold,
        uint256 quorumThreshold,
        uint256 emergencyThreshold
    );
    event GovernorAdded(address indexed governor);
    event GovernorRemoved(address indexed governor);
    event EmergencyAction(address indexed target, bytes data, string reason);

    constructor(
        address votingToken_,
        address timelock_,
        address treasury_,
        address admin
    ) {
        require(votingToken_ != address(0), "Invalid voting token");
        require(timelock_ != address(0), "Invalid timelock");
        require(treasury_ != address(0), "Invalid treasury");
        require(admin != address(0), "Invalid admin");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOVERNOR_ROLE, admin);
        _grantRole(TIMELOCK_ADMIN_ROLE, admin);
        _grantRole(EMERGENCY_ROLE, admin);

        votingToken = IERC20(votingToken_);
        timelock = timelock_;
        treasury = treasury_;

        // Set default governance settings
        settings = GovernanceSettings({
            votingDelay: 1, // 1 block
            votingPeriod: 17280, // ~3 days
            proposalThreshold: 1000 * 10**18, // 1000 SYLOS
            quorumThreshold: 10000 * 10**18, // 10K SYLOS
            emergencyThreshold: 50000 * 10**18, // 50K SYLOS
            minExecutionDelay: 2 days
        });
    }

    /**
     * @dev Create a new proposal
     * @param targets Target addresses for proposals
     * @param values ETH values for proposals
     * @param calldatas Function call data
     * @param title Proposal title
     * @param description Proposal description
     * @param evidence IPFS hash of proposal evidence
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory title,
        string memory description,
        string memory evidence
    ) public returns (uint256) {
        require(targets.length == values.length && targets.length == calldatas.length, "Array length mismatch");
        require(targets.length > 0 && targets.length <= 10, "Invalid number of actions");
        require(bytes(title).length > 0 && bytes(title).length <= 100, "Invalid title");
        require(bytes(description).length > 0 && bytes(description).length <= 1000, "Invalid description");
        require(getVotes(msg.sender, block.number - 1) >= settings.proposalThreshold, "Insufficient voting power");
        require(lockedFunds[msg.sender] >= minLockedAmount, "Insufficient locked funds");
        require(proposalCreatedByUser[msg.sender] < 5, "Too many active proposals"); // Limit proposals per user

        proposalCount++;
        uint256 proposalId = proposalCount;

        Proposal storage newProposal = proposals[proposalId];
        newProposal.id = proposalId;
        newProposal.proposer = msg.sender;
        newProposal.title = title;
        newProposal.description = description;
        newProposal.targets = targets;
        newProposal.values = values;
        newProposal.calldatas = calldatas;
        newProposal.startBlock = block.number.add(settings.votingDelay);
        newProposal.endBlock = block.number.add(settings.votingDelay).add(settings.votingPeriod);
        newProposal.forVotes = 0;
        newProposal.againstVotes = 0;
        newProposal.abstainVotes = 0;
        newProposal.executed = false;
        newProposal.canceled = false;
        newProposal.evidence = evidence;

        proposalCreatedByUser[msg.sender] += 1;

        emit ProposalCreated(proposalId, msg.sender, title, description, targets, values, evidence);
        return proposalId;
    }

    /**
     * @dev Vote on a proposal
     * @param proposalId Proposal ID
     * @param support Support type (0=abstain, 1=against, 2=for)
     * @param reason Optional reason for the vote
     */
    function vote(
        uint256 proposalId,
        uint8 support,
        string calldata reason
    ) public {
        require(support <= 2, "Invalid support value");
        require(proposals[proposalId].id != 0, "Proposal does not exist");
        require(block.number >= proposals[proposalId].startBlock, "Voting not started");
        require(block.number <= proposals[proposalId].endBlock, "Voting ended");
        require(!proposals[proposalId].hasVoted[msg.sender], "Already voted");

        uint256 weight = getVotes(msg.sender, block.number - 1);
        require(weight > 0, "No voting power");

        Proposal storage proposal = proposals[proposalId];
        proposal.hasVoted[msg.sender] = true;
        proposal.votes[msg.sender] = support;

        if (support == 0) {
            proposal.abstainVotes += weight;
        } else if (support == 1) {
            proposal.againstVotes += weight;
        } else {
            proposal.forVotes += weight;
        }

        emit Voted(msg.sender, proposalId, support, weight, reason);
    }

    /**
     * @dev Execute a proposal
     * @param proposalId Proposal ID
     */
    function execute(uint256 proposalId) public payable nonReentrant {
        require(proposals[proposalId].id != 0, "Proposal does not exist");
        require(block.number > proposals[proposalId].endBlock, "Voting not ended");
        require(!proposals[proposalId].executed, "Already executed");
        require(!proposals[proposalId].canceled, "Proposal canceled");

        Proposal storage proposal = proposals[proposalId];
        require(proposal.forVotes > proposal.againstVotes, "Proposal failed");
        require(proposal.forVotes >= settings.quorumThreshold, "Quorum not reached");
        require(block.timestamp >= proposal.startBlock + settings.minExecutionDelay, "Execution delay not met");

        // Queue timelock operations
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            _queueTimelockOperation(
                proposal.targets[i],
                proposal.values[i],
                proposal.calldatas[i]
            );
        }

        proposal.executed = true;

        emit ProposalExecuted(proposalId);
    }

    /**
     * @dev Cancel a proposal
     * @param proposalId Proposal ID
     */
    function cancel(uint256 proposalId) public {
        require(proposals[proposalId].id != 0, "Proposal does not exist");
        require(!proposals[proposalId].executed, "Cannot cancel executed proposal");
        require(
            msg.sender == proposals[proposalId].proposer || hasRole(EMERGENCY_ROLE, msg.sender),
            "Not authorized to cancel"
        );

        proposals[proposalId].canceled = true;

        emit ProposalCanceled(proposalId);
    }

    /**
     * @dev Delegate voting power
     * @param delegatee Address to delegate to
     */
    function delegate(address delegatee) public {
        require(delegatee != address(0), "Invalid delegatee");
        require(delegatee != msg.sender, "Cannot delegate to self");

        DelegateInfo storage currentDelegate = delegates[msg.sender];
        address previousDelegate = currentDelegate.delegatee;

        // Update previous delegate's delegated votes
        if (previousDelegate != address(0)) {
            delegates[previousDelegate].delegatedVotes -= currentDelegate.delegatedVotes;
        }

        // Set new delegate
        currentDelegate.delegatee = delegatee;
        currentDelegate.lastUpdate = block.timestamp;
        currentDelegate.isActive = true;

        uint256 userVotes = getVotes(msg.sender, block.number - 1);
        currentDelegate.delegatedVotes += userVotes;

        // Update delegate's total delegated votes
        delegates[delegatee].delegatedVotes += userVotes;
        totalDelegatedVotes += userVotes;

        emit DelegateChanged(msg.sender, previousDelegate, delegatee);
        emit DelegatedVotesChanged(delegatee, 0, delegates[delegatee].delegatedVotes);
    }

    /**
     * @dev Undelegate voting power
     */
    function undelegate() public {
        DelegateInfo storage currentDelegate = delegates[msg.sender];
        require(currentDelegate.delegatee != address(0), "No active delegation");

        address previousDelegate = currentDelegate.delegatee;
        uint256 delegatedVotes = currentDelegate.delegatedVotes;

        // Update delegate's delegated votes
        if (previousDelegate != address(0)) {
            delegates[previousDelegate].delegatedVotes -= delegatedVotes;
            totalDelegatedVotes -= delegatedVotes;
        }

        // Clear delegation
        currentDelegate.delegatee = address(0);
        currentDelegate.delegatedVotes = 0;
        currentDelegate.isActive = false;
        currentDelegate.lastUpdate = block.timestamp;

        emit DelegateChanged(msg.sender, previousDelegate, address(0));
        emit DelegatedVotesChanged(previousDelegate, 0, delegates[previousDelegate].delegatedVotes);
    }

    /**
     * @dev Lock funds for governance participation
     * @param amount Amount to lock
     */
    function lockFunds(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(votingToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        lockedFunds[msg.sender] += amount;
    }

    /**
     * @dev Unlock funds (with 7-day delay)
     * @param amount Amount to unlock
     */
    function unlockFunds(uint256 amount) external {
        require(lockedFunds[msg.sender] >= amount, "Insufficient locked funds");
        require(amount > 0, "Amount must be greater than 0");
        require(delegates[msg.sender].lastUpdate + 7 days <= block.timestamp, "Cannot unlock while actively delegating");
        
        lockedFunds[msg.sender] -= amount;
        require(votingToken.transfer(msg.sender, amount), "Transfer failed");
    }

    /**
     * @dev Add a governor
     * @param governor Address to add as governor
     */
    function addGovernor(address governor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(governor != address(0), "Invalid governor address");
        require(!governors[governor], "Already a governor");
        
        governors[governor] = true;
        grantRole(GOVERNOR_ROLE, governor);
        
        emit GovernorAdded(governor);
    }

    /**
     * @dev Remove a governor
     * @param governor Address to remove as governor
     */
    function removeGovernor(address governor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(governors[governor], "Not a governor");
        
        governors[governor] = false;
        revokeRole(GOVERNOR_ROLE, governor);
        
        emit GovernorRemoved(governor);
    }

    /**
     * @dev Execute emergency action - REENTRANCY PROTECTED
     * @param target Target contract
     * @param data Function call data
     * @param reason Reason for emergency action
     */
    function emergencyAction(
        address target,
        bytes calldata data,
        string calldata reason
    ) external onlyRole(EMERGENCY_ROLE) nonReentrant {
        require(target != address(0), "Invalid target");
        require(bytes(reason).length > 0, "Reason required");
        require(getVotes(msg.sender, block.number - 1) >= settings.emergencyThreshold, "Insufficient voting power");
        
        (bool success, bytes memory result) = target.call{value: 0}(data);
        require(success, "Emergency action failed");
        
        emit EmergencyAction(target, data, reason);
    }

    /**
     * @dev Update governance settings
     * @param newVotingDelay New voting delay
     * @param newVotingPeriod New voting period
     * @param newProposalThreshold New proposal threshold
     * @param newQuorumThreshold New quorum threshold
     * @param newEmergencyThreshold New emergency threshold
     */
    function updateSettings(
        uint256 newVotingDelay,
        uint256 newVotingPeriod,
        uint256 newProposalThreshold,
        uint256 newQuorumThreshold,
        uint256 newEmergencyThreshold
    ) external onlyRole(GOVERNOR_ROLE) {
        require(newVotingDelay <= MAX_VOTING_DELAY, "Voting delay too high");
        require(newVotingPeriod <= MAX_VOTING_PERIOD, "Voting period too high");
        require(newProposalThreshold >= MIN_PROPOSAL_THRESHOLD && newProposalThreshold <= MAX_PROPOSAL_THRESHOLD, "Invalid proposal threshold");
        require(newQuorumThreshold >= newProposalThreshold, "Quorum must be >= proposal threshold");
        require(newEmergencyThreshold >= newQuorumThreshold, "Emergency threshold must be >= quorum");

        settings = GovernanceSettings({
            votingDelay: newVotingDelay,
            votingPeriod: newVotingPeriod,
            proposalThreshold: newProposalThreshold,
            quorumThreshold: newQuorumThreshold,
            emergencyThreshold: newEmergencyThreshold,
            minExecutionDelay: settings.minExecutionDelay
        });

        emit SettingsUpdated(
            newVotingDelay,
            newVotingPeriod,
            newProposalThreshold,
            newQuorumThreshold,
            newEmergencyThreshold
        );
    }

    /**
     * @dev Get proposal state
     * @param proposalId Proposal ID
     */
    function proposalState(uint256 proposalId) public view returns (uint8) {
        if (proposals[proposalId].canceled) {
            return 2; // Canceled
        } else if (proposals[proposalId].executed) {
            return 4; // Executed
        } else if (block.number <= proposals[proposalId].startBlock) {
            return 0; // Pending
        } else if (block.number <= proposals[proposalId].endBlock) {
            return 1; // Active
        } else if (proposals[proposalId].forVotes <= proposals[proposalId].againstVotes || 
                   proposals[proposalId].forVotes < settings.quorumThreshold) {
            return 3; // Defeated
        } else {
            return 5; // Succeeded
        }
    }

    /**
     * @dev Get votes for an account
     * @param account Account address
     * @param blockNumber Block number to check votes at
     */
    function getVotes(address account, uint256 blockNumber) public view returns (uint256) {
        return votingToken.balanceOf(account);
    }

    /**
     * @dev Get proposal details
     * @param proposalId Proposal ID
     */
    function getProposal(uint256 proposalId) external view returns (
        uint256 id,
        address proposer,
        string memory title,
        string memory description,
        uint256 startBlock,
        uint256 endBlock,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        bool executed,
        bool canceled
    ) {
        Proposal storage p = proposals[proposalId];
        return (
            p.id,
            p.proposer,
            p.title,
            p.description,
            p.startBlock,
            p.endBlock,
            p.forVotes,
            p.againstVotes,
            p.abstainVotes,
            p.executed,
            p.canceled
        );
    }

    /**
     * @dev Get user delegation info
     * @param user User address
     */
    function getDelegateInfo(address user) external view returns (
        address delegatee,
        uint256 delegatedVotes,
        bool isActive,
        uint256 lastUpdate
    ) {
        DelegateInfo memory info = delegates[user];
        return (info.delegatee, info.delegatedVotes, info.isActive, info.lastUpdate);
    }
    
    /**
     * @dev Pause contract
     */
    function pause() external onlyRole(EMERGENCY_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyRole(EMERGENCY_ROLE) {
        _unpause();
    }

    /**
     * @dev Get governance settings
     */
    function getSettings() external view returns (GovernanceSettings memory) {
        return settings;
    }

    /**
     * @dev Queue timelock operation
     */
    function _queueTimelockOperation(
        address target,
        uint256 value,
        bytes memory data
    ) internal {
        bytes32 id = keccak256(abi.encode(target, value, data, block.timestamp));
        uint256 eta = block.timestamp + settings.minExecutionDelay;

        timelockOperations[id] = TimelockOperation({
            id: id,
            target: target,
            value: value,
            data: data,
            eta: eta,
            executed: false,
            canceled: false
        });

        emit TimelockOperationQueued(id, target, value, data, eta);
    }

    /**
     * @dev Execute timelock operation
     */
    function executeTimelockOperation(bytes32 id) external onlyRole(TIMELOCK_ADMIN_ROLE) {
        TimelockOperation storage operation = timelockOperations[id];
        require(operation.id != 0, "Operation does not exist");
        require(!operation.executed, "Already executed");
        require(!operation.canceled, "Operation canceled");
        require(block.timestamp >= operation.eta, "Timelock period not met");
        require(operation.target != address(0), "Invalid operation target");

        operation.executed = true;

        (bool success, bytes memory result) = operation.target.call{value: operation.value}(operation.data);
        require(success, "Timelock operation failed");

        emit TimelockOperationExecuted(id);
    }

    /**
     * @dev Cancel timelock operation
     */
    function cancelTimelockOperation(bytes32 id) external onlyRole(TIMELOCK_ADMIN_ROLE) {
        TimelockOperation storage operation = timelockOperations[id];
        require(operation.id != 0, "Operation does not exist");
        require(!operation.executed, "Cannot cancel executed operation");

        operation.canceled = true;

        emit TimelockOperationCanceled(id);
    }

    /**
     * @dev Emergency function to recover tokens
     */
    function recoverTokens(address tokenAddress, uint256 amount) external onlyRole(EMERGENCY_ROLE) {
        IERC20(tokenAddress).transfer(treasury, amount);
    }

    // Custom Timelock implementation

    function setTimelock(address newTimelock) external onlyRole(TIMELOCK_ADMIN_ROLE) {
        require(newTimelock != address(0), "Invalid timelock");
        timelock = newTimelock;
    }

    // Custom Votes implementation
    function clock() external view returns (uint48) {
        return uint48(block.number);
    }

    function CLOCK_MODE() external pure returns (string memory) {
        return "mode=blocknumber&from=latest";
    }
}
