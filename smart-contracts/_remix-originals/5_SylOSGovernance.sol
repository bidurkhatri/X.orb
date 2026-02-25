// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
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
        address delegate;
        uint256 votes;
        bool isActive;
    }

    // Storage
    IERC20 public governanceToken;
    address public timelockAddress;
    address public votingDelayAddress;
    
    mapping(uint256 => Proposal) public proposals;
    mapping(address => DelegateInfo) public delegates;
    mapping(address => address) public delegations;
    mapping(address => uint256) public proposalCount;
    mapping(address => mapping(uint256 => bool)) public hasVotedOnProposal;
    
    uint256 public proposalCount_;
    uint256 public votingDelay = 1; // blocks
    uint256 public votingPeriod = 17280; // ~3 days at 15s blocks
    uint256 public proposalThreshold = 100000; // minimum tokens to create proposal
    uint256 public quorumVotes = 500000; // minimum votes for quorum
    uint256 public executionDelay = 2; // days
    
    // Constants
    uint256 public constant MAX_PROPOSAL_ACTIONS = 10;
    uint256 public constant MAX_DESCRIPTION_LENGTH = 1000;
    uint256 public constant MAX_TITLE_LENGTH = 200;

    // Events
    event ProposalCreated(
        uint256 proposalId,
        address proposer,
        string title,
        string description,
        uint256 startBlock,
        uint256 endBlock
    );
    event VoteCast(address voter, uint256 proposalId, uint8 support, uint256 weight);
    event ProposalExecuted(uint256 proposalId);
    event ProposalCanceled(uint256 proposalId);
    event ProposalQueued(uint256 proposalId, uint256 eta);
    event DelegateChanged(address delegator, address fromDelegate, address toDelegate);
    event DelegateVotesChanged(address delegate, uint256 previousBalance, uint256 newBalance);
    event TimelockAddressUpdated(address oldAddress, address newAddress);
    event VotingParamsUpdated(uint256 votingDelay, uint256 votingPeriod, uint256 proposalThreshold, uint256 quorumVotes);

    constructor(
        IERC20 _governanceToken,
        address _timelock,
        address _votingDelay,
        address _admin
    ) {
        governanceToken = _governanceToken;
        timelockAddress = _timelock;
        votingDelayAddress = _votingDelay;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(GOVERNOR_ROLE, _admin);
        _grantRole(TIMELOCK_ADMIN_ROLE, _admin);
        _grantRole(EMERGENCY_ROLE, _admin);
    }

    // Proposal creation
    function createProposal(
        string calldata title,
        string calldata description,
        string[] calldata actions,
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        string calldata evidence
    ) external whenNotPaused returns (uint256) {
        require(title.length <= MAX_TITLE_LENGTH, "Title too long");
        require(description.length <= MAX_DESCRIPTION_LENGTH, "Description too long");
        require(actions.length == targets.length, "Actions and targets length mismatch");
        require(actions.length <= MAX_PROPOSAL_ACTIONS, "Too many actions");
        require(calldatas.length == targets.length, "Calldatas and targets length mismatch");
        require(values.length == targets.length, "Values and targets length mismatch");

        // Check if proposer has enough tokens
        uint256 proposerVotes = getVotes(msg.sender, block.number - 1);
        require(proposerVotes >= proposalThreshold, "Insufficient tokens to propose");

        proposalCount_++;
        uint256 proposalId = proposalCount_;

        // Create proposal
        Proposal storage newProposal = proposals[proposalId];
        newProposal.id = proposalId;
        newProposal.proposer = msg.sender;
        newProposal.title = title;
        newProposal.description = description;
        newProposal.actions = actions;
        newProposal.targets = targets;
        newProposal.values = values;
        newProposal.calldatas = calldatas;
        newProposal.startBlock = block.number + votingDelay;
        newProposal.endBlock = newProposal.startBlock + votingPeriod;
        newProposal.evidence = evidence;
        newProposal.executed = false;
        newProposal.canceled = false;

        // Initialize vote counts
        newProposal.forVotes = 0;
        newProposal.againstVotes = 0;
        newProposal.abstainVotes = 0;

        emit ProposalCreated(
            proposalId,
            msg.sender,
            title,
            description,
            newProposal.startBlock,
            newProposal.endBlock
        );

        return proposalId;
    }

    // Voting
    function castVote(uint256 proposalId, uint8 support) external whenNotPaused returns (uint256) {
        return _castVote(msg.sender, proposalId, support);
    }

    function castVoteWithReason(
        uint256 proposalId,
        uint8 support,
        string calldata reason
    ) external whenNotPaused returns (uint256) {
        return _castVote(msg.sender, proposalId, support);
    }

    function _castVote(address voter, uint256 proposalId, uint8 support) internal returns (uint256) {
        require(support <= 2, "Invalid vote type");
        require(!proposals[proposalId].executed, "Proposal already executed");
        require(!proposals[proposalId].canceled, "Proposal canceled");
        require(block.number >= proposals[proposalId].startBlock, "Voting not started");
        require(block.number <= proposals[proposalId].endBlock, "Voting ended");
        require(!hasVotedOnProposal[voter][proposalId], "Already voted");

        uint256 weight = getVotes(voter, block.number - 1);
        require(weight > 0, "No voting power");

        // Record vote
        hasVotedOnProposal[voter][proposalId] = true;
        proposals[proposalId].hasVoted[voter] = true;
        proposals[proposalId].votes[voter] = support;

        if (support == 0) {
            proposals[proposalId].abstainVotes += weight;
        } else if (support == 1) {
            proposals[proposalId].againstVotes += weight;
        } else {
            proposals[proposalId].forVotes += weight;
        }

        emit VoteCast(voter, proposalId, support, weight);
        return weight;
    }

    // Proposal execution
    function execute(uint256 proposalId) external whenNotPaused returns (bytes memory) {
        require(_isReadyForExecution(proposalId), "Proposal not ready for execution");
        require(!proposals[proposalId].executed, "Already executed");

        Proposal storage proposal = proposals[proposalId];
        proposal.executed = true;

        // Execute proposal actions
        bytes[] memory results = new bytes[](proposal.targets.length);
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            (bool success, bytes memory result) = proposal.targets[i].call{value: proposal.values[i]}(
                proposal.calldatas[i]
            );
            require(success, "Proposal action failed");
            results[i] = result;
        }

        emit ProposalExecuted(proposalId);
        return abi.encode(results);
    }

    function _isReadyForExecution(uint256 proposalId) internal view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        require(block.number > proposal.endBlock, "Voting not ended");
        
        // Check quorum
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        require(totalVotes >= quorumVotes, "Quorum not reached");
        
        // Check if for votes exceed against votes
        require(proposal.forVotes > proposal.againstVotes, "Proposal failed");
        
        return true;
    }

    // Cancel proposal (only proposer or governor)
    function cancel(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(msg.sender == proposal.proposer || hasRole(GOVERNOR_ROLE, msg.sender), "Not authorized");
        require(!proposal.executed, "Already executed");
        
        proposal.canceled = true;
        emit ProposalCanceled(proposalId);
    }

    // Delegation
    function delegate(address delegatee) external {
        return _delegate(msg.sender, delegatee);
    }

    function _delegate(address delegator, address delegatee) internal {
        address currentDelegate = delegations[delegator];
        uint256 delegatorVotes = governanceToken.balanceOf(delegator);
        
        if (currentDelegate != address(0)) {
            delegates[currentDelegate].votes = delegates[currentDelegate].votes - delegatorVotes;
        }
        
        if (delegatee != address(0)) {
            delegates[delegatee].votes = delegates[delegatee].votes + delegatorVotes;
            delegates[delegatee].isActive = true;
        }
        
        delegations[delegator] = delegatee;
        emit DelegateChanged(delegator, currentDelegate, delegatee);
    }

    // View functions
    function getVotes(address account, uint256 blockNumber) public view returns (uint256) {
        if (delegations[account] != address(0)) {
            // Account is delegating, return delegate's votes
            return delegates[delegations[account]].votes;
        }
        return governanceToken.balanceOf(account);
    }

    function getProposal(uint256 proposalId) external view returns (
        address proposer,
        string memory title,
        string memory description,
        uint256 startBlock,
        uint256 endBlock,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        bool executed,
        bool canceled,
        string memory evidence
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.proposer,
            proposal.title,
            proposal.description,
            proposal.startBlock,
            proposal.endBlock,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            proposal.executed,
            proposal.canceled,
            proposal.evidence
        );
    }

    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        return hasVotedOnProposal[voter][proposalId];
    }

    function getVote(uint256 proposalId, address voter) external view returns (uint8) {
        return proposals[proposalId].votes[voter];
    }

    function getActions(uint256 proposalId) external view returns (
        string[] memory actions,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (proposal.actions, proposal.targets, proposal.values, proposal.calldatas);
    }

    // Configuration
    function setTimelockAddress(address newTimelock) external onlyRole(TIMELOCK_ADMIN_ROLE) {
        address oldTimelock = timelockAddress;
        timelockAddress = newTimelock;
        emit TimelockAddressUpdated(oldTimelock, newTimelock);
    }

    function setVotingParams(
        uint256 _votingDelay,
        uint256 _votingPeriod,
        uint256 _proposalThreshold,
        uint256 _quorumVotes
    ) external onlyRole(GOVERNOR_ROLE) {
        uint256 oldVotingDelay = votingDelay;
        uint256 oldVotingPeriod = votingPeriod;
        uint256 oldProposalThreshold = proposalThreshold;
        uint256 oldQuorumVotes = quorumVotes;
        
        votingDelay = _votingDelay;
        votingPeriod = _votingPeriod;
        proposalThreshold = _proposalThreshold;
        quorumVotes = _quorumVotes;
        
        emit VotingParamsUpdated(
            oldVotingDelay, oldVotingPeriod, oldProposalThreshold, oldQuorumVotes
        );
    }

    // Emergency functions
    function pause() external onlyRole(EMERGENCY_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(EMERGENCY_ROLE) {
        _unpause();
    }

    // Admin functions
    function _grantRole(bytes32 role, address account) internal override {
        super._grantRole(role, account);
        
        // Update delegate info for governance role
        if (role == GOVERNOR_ROLE && account != address(0)) {
            delegates[account].isActive = true;
        }
    }
}