// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SylOSGovernance
 * @dev implementation of the Dual-Layer Governance Ecosystem (Phase 5.17)
 * Humans (Token Holders) establish the constitution and extreme parameter boundaries.
 * AI Agents (Productivity Nodes) can only vote on micro-optimizations within those bounds.
 * Integrates a Vote-Escrow (veSYLOS) mechanism to prevent flash-loan governance attacks.
 */
contract SylOSGovernance is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE"); // Granted to autonomous agents

    IERC20 public immutable wrappedSYLOS;

    struct LockParams {
        uint256 amount;
        uint256 unlockTime;
        uint256 votingPower;
    }

    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        bool isMicroOptimization; // True = Agent eligible limits, False = Core constitutional edits
        uint256 forVotesHuman;
        uint256 againstVotesHuman;
        uint256 forVotesAgent;
        uint256 againstVotesAgent;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        bool canceled;
    }

    mapping(address => LockParams) public veLocks;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    
    uint256 public proposalCount;
    uint256 public constant MIN_LOCK_TIME = 1 weeks;
    uint256 public constant MAX_LOCK_TIME = 52 weeks;
    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant EXECUTION_DELAY = 1 days; // Timelock: 24h delay after voting ends
    uint256 public constant QUORUM_BPS = 500; // 5% of total locked supply must vote
    uint256 public constant PROPOSAL_THRESHOLD = 1000 * 10**18; // 1,000 wSYLOS required to propose

    uint256 public totalLockedSupply; // Track total veSYLOS for quorum calculation

    event VEDeposited(address indexed user, uint256 amount, uint256 lockDuration, uint256 votingPower);
    event VEWithdrawn(address indexed user, uint256 amount);
    event ProposalCreated(uint256 indexed id, address indexed proposer, string description, bool isMicroOptimization);
    event VoteCast(address indexed voter, uint256 indexed proposalId, bool support, uint256 weight, bool isAgent);
    event ProposalExecuted(uint256 indexed id);
    event ProposalCanceled(uint256 indexed id);

    constructor(address _wrappedSYLOS, address _admin) {
        require(_wrappedSYLOS != address(0), "Invalid token address");
        wrappedSYLOS = IERC20(_wrappedSYLOS);
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    }

    /**
     * @dev Lock wSYLOS to gain veSYLOS voting power. Mitigates flash loans.
     */
    function createLock(uint256 _amount, uint256 _weeks) external nonReentrant {
        require(_amount > 0, "Cannot lock 0");
        uint256 lockDuration = _weeks * 1 weeks;
        require(lockDuration >= MIN_LOCK_TIME && lockDuration <= MAX_LOCK_TIME, "Invalid lock duration");
        require(veLocks[msg.sender].amount == 0, "Lock exists, use increaseLock");

        wrappedSYLOS.safeTransferFrom(msg.sender, address(this), _amount);

        // Voting power multiplier: 1x for 1 week, up to 4x for 52 weeks
        uint256 multiplier = 100 + ((lockDuration * 300) / MAX_LOCK_TIME);
        uint256 vPower = (_amount * multiplier) / 100;

        totalLockedSupply += vPower;

        veLocks[msg.sender] = LockParams({
            amount: _amount,
            unlockTime: block.timestamp + lockDuration,
            votingPower: vPower
        });

        emit VEDeposited(msg.sender, _amount, lockDuration, vPower);
    }

    /**
     * @dev Withdraw locked wSYLOS after unlockTime expires.
     */
    function withdrawLock() external nonReentrant {
        LockParams storage params = veLocks[msg.sender];
        require(params.amount > 0, "No lock exists");
        require(block.timestamp >= params.unlockTime, "Lock is still active");

        uint256 amt = params.amount;
        totalLockedSupply -= params.votingPower;
        delete veLocks[msg.sender];

        wrappedSYLOS.safeTransfer(msg.sender, amt);
        emit VEWithdrawn(msg.sender, amt);
    }

    /**
     * @dev Allows humans to propose system upgrades. Agents cannot propose currently.
     */
    function propose(string calldata _description, bool _isMicroOptimization) external returns (uint256) {
        require(veLocks[msg.sender].votingPower >= PROPOSAL_THRESHOLD, "Insufficient veSYLOS to propose");
        
        uint256 propId = ++proposalCount;
        Proposal storage p = proposals[propId];
        p.id = propId;
        p.proposer = msg.sender;
        p.description = _description;
        p.isMicroOptimization = _isMicroOptimization;
        p.startTime = block.timestamp;
        p.endTime = block.timestamp + VOTING_PERIOD;

        emit ProposalCreated(propId, msg.sender, _description, _isMicroOptimization);
        return propId;
    }

    /**
     * @dev Cast a vote. Detects if the voter is an AI Agent or a Human (Token Holder).
     */
    function castVote(uint256 _proposalId, bool _support) external {
        Proposal storage p = proposals[_proposalId];
        require(block.timestamp >= p.startTime && block.timestamp <= p.endTime, "Voting closed");
        require(!hasVoted[_proposalId][msg.sender], "Already voted");

        bool isAgent = hasRole(AGENT_ROLE, msg.sender);
        
        if (isAgent) {
            require(p.isMicroOptimization, "Agents can only vote on micro-optimizations");
            // Agent vote weight is fixed to 1 for this prototype (future: mapped to PoP score)
            uint256 weight = 1 * 10**18;
            
            if (_support) p.forVotesAgent += weight;
            else p.againstVotesAgent += weight;

            hasVoted[_proposalId][msg.sender] = true;
            emit VoteCast(msg.sender, _proposalId, _support, weight, true);
        } else {
            // Human voting logic based on veSYLOS
            uint256 weight = veLocks[msg.sender].votingPower;
            require(weight > 0, "No voting weight");

            if (_support) p.forVotesHuman += weight;
            else p.againstVotesHuman += weight;

            hasVoted[_proposalId][msg.sender] = true;
            emit VoteCast(msg.sender, _proposalId, _support, weight, false);
        }
    }

    /**
     * @dev Cancel a proposal. Only the proposer (before vote end) or admin can cancel.
     */
    function cancelProposal(uint256 _proposalId) external {
        Proposal storage p = proposals[_proposalId];
        require(!p.executed && !p.canceled, "Already resolved");
        require(
            msg.sender == p.proposer || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Only proposer or admin can cancel"
        );

        p.canceled = true;
        emit ProposalCanceled(_proposalId);
    }

    /**
     * @dev Finalize proposal outcome with quorum check and timelock.
     * Requires 24h delay after voting ends (timelock) and 5% quorum of total locked supply.
     */
    function executeProposal(uint256 _proposalId) external nonReentrant {
        Proposal storage p = proposals[_proposalId];
        require(block.timestamp > p.endTime, "Voting is ongoing");
        require(block.timestamp > p.endTime + EXECUTION_DELAY, "Timelock: must wait 24h after vote ends");
        require(!p.executed && !p.canceled, "Already resolved");

        bool passed = false;
        
        if (p.isMicroOptimization) {
            uint256 totalFor = p.forVotesHuman + p.forVotesAgent;
            uint256 totalAgainst = p.againstVotesHuman + p.againstVotesAgent;
            uint256 totalVotes = totalFor + totalAgainst;
            // Quorum: at least 5% of total locked supply must have voted
            require(totalVotes >= (totalLockedSupply * QUORUM_BPS) / 10000, "Quorum not reached");
            if (totalFor > totalAgainst) {
                passed = true;
            }
        } else {
            uint256 totalHuman = p.forVotesHuman + p.againstVotesHuman;
            // Constitutional: quorum based on human votes only
            require(totalHuman >= (totalLockedSupply * QUORUM_BPS) / 10000, "Quorum not reached");
            if (p.forVotesHuman > p.againstVotesHuman) {
                passed = true;
            }
        }

        require(passed, "Proposal did not pass majority");
        p.executed = true;
        
        emit ProposalExecuted(_proposalId);
    }
}
