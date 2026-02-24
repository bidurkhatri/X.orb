// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";

interface IGovernanceToken {
    function balanceOf(address account) external view returns (uint256);
    function getPastVotes(address account, uint256 blockNumber) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

/**
 * @title QuadraticGovernance
 * @dev Advanced DAO governance with quadratic voting and multi-signature treasury
 */
contract QuadraticGovernance is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    using Math for uint256;

    // Events
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string description,
        uint256 startTime,
        uint256 endTime
    );

    event VoteCast(
        address indexed voter,
        uint256 indexed proposalId,
        uint8 support,
        uint256 weight,
        uint256 tokensUsed
    );

    event ProposalExecuted(
        uint256 indexed proposalId,
        address indexed executor,
        bool success
    );

    event ProposalCanceled(
        uint256 indexed proposalId,
        address indexed canceller
    );

    event QuorumUpdated(uint256 newQuorum);
    event VotingPeriodUpdated(uint256 newPeriod);
    event TimelockPeriodUpdated(uint256 newPeriod);
    event TreasuryUpdated(address indexed newTreasury);
    event GovernorRoleGranted(address indexed account, bytes32 indexed role);
    event GovernorRoleRevoked(address indexed account, bytes32 indexed role);

    // Constants
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");
    
    uint256 public constant MAX_VOTING_PERIOD = 4 weeks;
    uint256 public constant MIN_VOTING_PERIOD = 3 days;
    uint256 public constant MAX_PROPOSAL_THRESHOLD = 1000000e18; // 1M tokens
    uint256 public constant MIN_PROPOSAL_THRESHOLD = 100e18; // 100 tokens
    uint256 public constant MAX_QUORUM = 10000000e18; // 10M tokens
    uint256 public constant MIN_QUORUM = 10000e18; // 10K tokens

    // State variables
    IGovernanceToken public immutable governanceToken;
    ITreasuryManager public treasury;
    
    struct Proposal {
        address proposer;
        string description;
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 executionETA;
        bool executed;
        bool canceled;
        bool queued;
        bytes32 proposalHash;
        uint256 createdAt;
    }
    
    struct Vote {
        bool hasVoted;
        uint8 support;
        uint256 weight;
        uint256 tokensUsed;
        uint256 timestamp;
    }
    
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => Vote)) public proposalVotes;
    mapping(uint256 => address[]) private _proposalVotesList;
    
    uint256 public proposalCount;
    uint256 public proposalThreshold = 1000e18; // 1K tokens
    uint256 public quorumVotes = 10000e18; // 10K tokens
    uint256 public votingPeriod = 1 weeks;
    uint256 public timelockPeriod = 2 days;
    uint256 public votingDelay = 1 days;
    
    mapping(address => bool) public hasRole;
    mapping(uint256 => bytes32) public proposalHashes;
    mapping(bytes32 => bool) public executedTransactions;
    
    // Modifiers
    modifier onlyProposer() {
        require(hasRole[msg.sender] || hasRole[PROPOSER_ROLE] || msg.sender == owner(), "Not proposer");
        _;
    }
    
    modifier onlyExecutor() {
        require(hasRole[msg.sender] || hasRole[EXECUTOR_ROLE] || msg.sender == owner(), "Not executor");
        _;
    }
    
    modifier onlyCanceller() {
        require(hasRole[msg.sender] || hasRole[CANCELLER_ROLE] || msg.sender == owner(), "Not canceller");
        _;
    }
    
    modifier onlyGovernance() {
        require(msg.sender == address(treasury) || msg.sender == owner(), "Not governance");
        _;
    }

    constructor(
        address _governanceToken,
        address _treasury,
        address[] memory _proposers,
        address[] memory _executors,
        address[] memory _cancellers
    ) {
        require(_governanceToken != address(0), "Invalid token address");
        require(_treasury != address(0), "Invalid treasury address");
        
        governanceToken = IGovernanceToken(_governanceToken);
        treasury = ITreasuryManager(_treasury);
        
        // Setup roles
        for (uint256 i = 0; i < _proposers.length; i++) {
            _grantRole(_proposers[i], PROPOSER_ROLE);
        }
        
        for (uint256 i = 0; i < _executors.length; i++) {
            _grantRole(_executors[i], EXECUTOR_ROLE);
        }
        
        for (uint256 i = 0; i < _cancellers.length; i++) {
            _grantRole(_cancellers[i], CANCELLER_ROLE);
        }
    }

    /**
     * @dev Create a new proposal
     */
    function createProposal(string memory description, bytes[] calldata targets, uint256[] calldata values, bytes[] calldata calldatas) 
        external returns (uint256) {
        require(bytes(description).length > 0, "Description required");
        require(_hasVotingPower(msg.sender), "Insufficient voting power");
        require(_proposalThresholdMet(msg.sender), "Proposal threshold not met");
        
        uint256 proposalId = ++proposalCount;
        
        Proposal storage proposal = proposals[proposalId];
        proposal.proposer = msg.sender;
        proposal.description = description;
        proposal.startBlock = block.number.add(votingDelay);
        proposal.endBlock = proposal.startBlock.add(votingPeriod);
        proposal.createdAt = block.timestamp;
        
        // Store proposal hash for execution
        if (targets.length > 0) {
            proposal.proposalHash = _getProposalHash(proposalId, targets, values, calldatas);
            proposalHashes[proposalId] = proposal.proposalHash;
        }
        
        emit ProposalCreated(
            proposalId,
            msg.sender,
            description,
            block.timestamp.add(votingDelay * 12), // Rough conversion to seconds
            block.timestamp.add((proposal.startBlock.add(votingPeriod) - block.number) * 12)
        );
        
        return proposalId;
    }

    /**
     * @dev Cast a vote with quadratic weighting
     */
    function castVote(
        uint256 proposalId,
        uint8 support,
        uint256 amount
    ) external nonReentrant {
        require(support <= 2, "Invalid vote type"); // 0 = against, 1 = for, 2 = abstain
        require(amount > 0, "Invalid amount");
        require(proposals[proposalId].proposer != address(0), "Proposal doesn't exist");
        require(block.number >= proposals[proposalId].startBlock, "Voting not started");
        require(block.number <= proposals[proposalId].endBlock, "Voting ended");
        require(!proposalVotes[proposalId][msg.sender].hasVoted, "Already voted");
        
        // Quadratic voting: weight = sqrt(tokens)
        uint256 weight = _sqrt(amount);
        
        // Check if user has enough tokens
        uint256 userBalance = governanceToken.balanceOf(msg.sender);
        require(userBalance >= amount, "Insufficient tokens");
        
        // Update proposal votes
        if (support == 0) {
            proposals[proposalId].againstVotes = proposals[proposalId].againstVotes.add(weight);
        } else if (support == 1) {
            proposals[proposalId].forVotes = proposals[proposalId].forVotes.add(weight);
        } else {
            proposals[proposalId].abstainVotes = proposals[proposalId].abstainVotes.add(weight);
        }
        
        // Store vote
        proposalVotes[proposalId][msg.sender] = Vote({
            hasVoted: true,
            support: support,
            weight: weight,
            tokensUsed: amount,
            timestamp: block.timestamp
        });
        
        _proposalVotesList[proposalId].push(msg.sender);
        
        emit VoteCast(msg.sender, proposalId, support, weight, amount);
    }

    /**
     * @dev Execute a successful proposal
     */
    function executeProposal(
        uint256 proposalId,
        bytes[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas
    ) external onlyExecutor {
        require(proposals[proposalId].proposer != address(0), "Proposal doesn't exist");
        require(!proposals[proposalId].executed, "Already executed");
        require(!proposals[proposalId].canceled, "Proposal canceled");
        require(block.number > proposals[proposalId].endBlock, "Voting not ended");
        require(_proposalSucceeded(proposalId), "Proposal not successful");
        
        // Verify proposal hash
        require(proposalHashes[proposalId] == _getProposalHash(proposalId, targets, values, calldatas), "Proposal hash mismatch");
        
        proposals[proposalId].executed = true;
        proposals[proposalId].executionETA = block.timestamp.add(timelockPeriod);
        
        // Execute proposal calls
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, ) = treasury.executeTransaction(targets[i], values[i], "", calldatas[i]);
            require(success, "Proposal execution failed");
        }
        
        emit ProposalExecuted(proposalId, msg.sender, true);
    }

    /**
     * @dev Cancel a proposal
     */
    function cancelProposal(uint256 proposalId) external onlyCanceller {
        require(proposals[proposalId].proposer != address(0), "Proposal doesn't exist");
        require(!proposals[proposalId].executed, "Cannot cancel executed proposal");
        require(!proposals[proposalId].canceled, "Already canceled");
        
        proposals[proposalId].canceled = true;
        
        emit ProposalCanceled(proposalId, msg.sender);
    }

    /**
     * @dev Get proposal details
     */
    function getProposal(uint256 proposalId) external view returns (
        address proposer,
        string memory description,
        uint256 startBlock,
        uint256 endBlock,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        bool executed,
        bool canceled,
        uint256 executionETA
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.proposer,
            proposal.description,
            proposal.startBlock,
            proposal.endBlock,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            proposal.executed,
            proposal.canceled,
            proposal.executionETA
        );
    }

    /**
     * @dev Get user vote for a proposal
     */
    function getUserVote(uint256 proposalId, address user) external view returns (
        bool hasVoted,
        uint8 support,
        uint256 weight,
        uint256 tokensUsed,
        uint256 timestamp
    ) {
        Vote storage vote = proposalVotes[proposalId][user];
        return (vote.hasVoted, vote.support, vote.weight, vote.tokensUsed, vote.timestamp);
    }

    /**
     * @dev Get proposal results
     */
    function getProposalResults(uint256 proposalId) external view returns (
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        bool hasQuorum,
        bool hasMajority
    ) {
        Proposal storage proposal = proposals[proposalId];
        uint256 totalVotes = proposal.forVotes.add(proposal.againstVotes).add(proposal.abstainVotes);
        
        return (
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            totalVotes >= quorumVotes,
            proposal.forVotes > proposal.againstVotes
        );
    }

    /**
     * @dev Check if user has voting power
     */
    function _hasVotingPower(address user) internal view returns (bool) {
        return governanceToken.balanceOf(user) >= proposalThreshold;
    }

    /**
     * @dev Check if proposal threshold is met
     */
    function _proposalThresholdMet(address proposer) internal view returns (bool) {
        return governanceToken.balanceOf(proposer) >= proposalThreshold;
    }

    /**
     * @dev Check if proposal succeeded
     */
    function _proposalSucceeded(uint256 proposalId) internal view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        uint256 totalVotes = proposal.forVotes.add(proposal.againstVotes).add(proposal.abstainVotes);
        
        return totalVotes >= quorumVotes && 
               proposal.forVotes > proposal.againstVotes && 
               proposal.forVotes > 0;
    }

    /**
     * @dev Calculate square root (for quadratic voting)
     */
    function _sqrt(uint256 x) internal pure returns (uint256) {
        return x.sqrt();
    }

    /**
     * @dev Get proposal hash
     */
    function _getProposalHash(
        uint256 proposalId,
        bytes[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(proposalId, targets, values, calldatas));
    }

    /**
     * @dev Grant role
     */
    function _grantRole(address account, bytes32 role) internal {
        require(account != address(0), "Invalid account");
        hasRole[account] = true;
        emit GovernorRoleGranted(account, role);
    }

    /**
     * @dev Revoke role
     */
    function _revokeRole(address account, bytes32 role) internal {
        hasRole[account] = false;
        emit GovernorRoleRevoked(account, role);
    }

    /**
     * @dev Update proposal threshold
     */
    function setProposalThreshold(uint256 newThreshold) external onlyGovernance {
        require(newThreshold >= MIN_PROPOSAL_THRESHOLD && newThreshold <= MAX_PROPOSAL_THRESHOLD, "Invalid threshold");
        proposalThreshold = newThreshold;
    }

    /**
     * @dev Update quorum votes
     */
    function setQuorum(uint256 newQuorum) external onlyGovernance {
        require(newQuorum >= MIN_QUORUM && newQuorum <= MAX_QUORUM, "Invalid quorum");
        quorumVotes = newQuorum;
        emit QuorumUpdated(newQuorum);
    }

    /**
     * @dev Update voting period
     */
    function setVotingPeriod(uint256 newPeriod) external onlyGovernance {
        require(newPeriod >= MIN_VOTING_PERIOD && newPeriod <= MAX_VOTING_PERIOD, "Invalid period");
        votingPeriod = newPeriod;
        emit VotingPeriodUpdated(newPeriod);
    }

    /**
     * @dev Update timelock period
     */
    function setTimelockPeriod(uint256 newPeriod) external onlyGovernance {
        require(newPeriod >= 1 days && newPeriod <= 1 weeks, "Invalid timelock period");
        timelockPeriod = newPeriod;
        emit TimelockPeriodUpdated(newPeriod);
    }

    /**
     * @dev Update treasury
     */
    function setTreasury(address newTreasury) external onlyGovernance {
        require(newTreasury != address(0), "Invalid treasury address");
        treasury = ITreasuryManager(newTreasury);
        emit TreasuryUpdated(newTreasury);
    }

    /**
     * @dev Grant proposer role
     */
    function grantProposerRole(address account) external onlyOwner {
        _grantRole(account, PROPOSER_ROLE);
    }

    /**
     * @dev Grant executor role
     */
    function grantExecutorRole(address account) external onlyOwner {
        _grantRole(account, EXECUTOR_ROLE);
    }

    /**
     * @dev Grant canceller role
     */
    function grantCancellerRole(address account) external onlyOwner {
        _grantRole(account, CANCELLER_ROLE);
    }

    /**
     * @dev Revoke proposer role
     */
    function revokeProposerRole(address account) external onlyOwner {
        _revokeRole(account, PROPOSER_ROLE);
    }

    /**
     * @dev Revoke executor role
     */
    function revokeExecutorRole(address account) external onlyOwner {
        _revokeRole(account, EXECUTOR_ROLE);
    }

    /**
     * @dev Revoke canceller role
     */
    function revokeCancellerRole(address account) external onlyOwner {
        _revokeRole(account, CANCELLER_ROLE);
    }

    /**
     * @dev View function to check if user has role
     */
    function hasGovernanceRole(address account, bytes32 role) external view returns (bool) {
        return hasRole[account] || (role == PROPOSER_ROLE && hasRole[PROPOSER_ROLE]) ||
               (role == EXECUTOR_ROLE && hasRole[EXECUTOR_ROLE]) ||
               (role == CANCELLER_ROLE && hasRole[CANCELLER_ROLE]);
    }
}

interface ITreasuryManager {
    function executeTransaction(
        address target,
        uint256 value,
        string calldata signature,
        bytes calldata data
    ) external payable returns (bytes memory);
}
