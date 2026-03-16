// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PaymentStreaming
 * @dev Continuous micropayment streams for agent services in Xorb.
 *
 * In the Xorb network, agents earn money for work. Rather than
 * lump-sum payments, sponsors stream USDC to agents over time:
 *
 * - Sponsors create streams to fund agent work
 * - Agents accrue tokens per-second while performing tasks
 * - Sponsors can top up, pause, or cancel streams
 * - Agents can withdraw accrued earnings
 * - Streams auto-stop when depleted
 *
 * Think of it as continuous payroll for AI workers.
 */
contract PaymentStreaming is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IERC20 public immutable paymentToken; // USDC

    // --- Types ---

    enum StreamStatus { Active, Paused, Cancelled, Depleted }

    struct Stream {
        uint256 streamId;
        address sponsor;          // who pays
        bytes32 agentId;          // who earns
        address agentWallet;      // agent's session wallet for withdrawals
        uint256 ratePerSecond;    // USDC per second (in wei)
        uint256 deposit;          // total deposited by sponsor
        uint256 withdrawn;        // total withdrawn by agent
        uint256 startTime;        // stream start
        uint256 lastWithdrawAt;   // last withdrawal timestamp
        uint256 pausedAt;         // 0 if not paused, else timestamp
        uint256 pausedDuration;   // accumulated paused time
        StreamStatus status;
        string memo;              // what the stream is for
    }

    // --- Storage ---

    uint256 public nextStreamId = 1;
    mapping(uint256 => Stream) public streams;

    // Sponsor → their stream IDs
    mapping(address => uint256[]) public sponsorStreams;
    // Agent → their stream IDs
    mapping(bytes32 => uint256[]) public agentStreams;

    // Protocol fee (basis points, e.g. 50 = 0.5%)
    uint256 public protocolFeeBps = 50;
    address public treasury;
    uint256 public totalFeesCollected;

    // --- Events ---

    event StreamCreated(uint256 indexed streamId, address indexed sponsor, bytes32 indexed agentId, uint256 ratePerSecond, uint256 deposit);
    event StreamTopUp(uint256 indexed streamId, uint256 amount, uint256 newDeposit);
    event StreamPaused(uint256 indexed streamId);
    event StreamResumed(uint256 indexed streamId);
    event StreamCancelled(uint256 indexed streamId, uint256 refundedToSponsor, uint256 paidToAgent);
    event Withdrawal(uint256 indexed streamId, bytes32 indexed agentId, uint256 amount, uint256 fee);

    // --- Constructor ---

    constructor(address _token, address _treasury) {
        require(_token != address(0), "Invalid token");
        require(_treasury != address(0), "Invalid treasury");
        paymentToken = IERC20(_token);
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    // --- Core Functions ---

    /**
     * @dev Create a new payment stream to an agent.
     * @param agentId The on-chain agent ID
     * @param agentWallet The agent's session wallet that can withdraw
     * @param ratePerSecond Payment rate in wei/second
     * @param deposit Initial deposit (must cover at least 1 hour)
     * @param memo Description of what the stream funds
     */
    function createStream(
        bytes32 agentId,
        address agentWallet,
        uint256 ratePerSecond,
        uint256 deposit,
        string calldata memo
    ) external nonReentrant whenNotPaused returns (uint256 streamId) {
        require(agentId != bytes32(0), "Invalid agent");
        require(agentWallet != address(0), "Invalid wallet");
        require(ratePerSecond > 0, "Rate must be > 0");
        require(deposit >= ratePerSecond * 3600, "Min deposit = 1 hour of streaming");

        // Transfer deposit from sponsor
        paymentToken.safeTransferFrom(msg.sender, address(this), deposit);

        streamId = nextStreamId++;
        streams[streamId] = Stream({
            streamId: streamId,
            sponsor: msg.sender,
            agentId: agentId,
            agentWallet: agentWallet,
            ratePerSecond: ratePerSecond,
            deposit: deposit,
            withdrawn: 0,
            startTime: block.timestamp,
            lastWithdrawAt: block.timestamp,
            pausedAt: 0,
            pausedDuration: 0,
            status: StreamStatus.Active,
            memo: memo
        });

        sponsorStreams[msg.sender].push(streamId);
        agentStreams[agentId].push(streamId);

        emit StreamCreated(streamId, msg.sender, agentId, ratePerSecond, deposit);
    }

    /**
     * @dev Top up an existing stream with more funds.
     */
    function topUp(uint256 streamId, uint256 amount) external nonReentrant {
        Stream storage s = streams[streamId];
        require(s.sponsor == msg.sender, "Not sponsor");
        require(s.status == StreamStatus.Active || s.status == StreamStatus.Paused, "Stream ended");
        require(amount > 0, "Amount must be > 0");

        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        s.deposit += amount;

        // Reactivate if was depleted
        if (s.status == StreamStatus.Paused && _getEarned(s) < s.deposit) {
            s.status = StreamStatus.Active;
        }

        emit StreamTopUp(streamId, amount, s.deposit);
    }

    /**
     * @dev Pause a stream (sponsor only). Agent stops earning.
     */
    function pauseStream(uint256 streamId) external {
        Stream storage s = streams[streamId];
        require(s.sponsor == msg.sender, "Not sponsor");
        require(s.status == StreamStatus.Active, "Not active");

        s.status = StreamStatus.Paused;
        s.pausedAt = block.timestamp;

        emit StreamPaused(streamId);
    }

    /**
     * @dev Resume a paused stream.
     */
    function resumeStream(uint256 streamId) external {
        Stream storage s = streams[streamId];
        require(s.sponsor == msg.sender, "Not sponsor");
        require(s.status == StreamStatus.Paused, "Not paused");
        require(s.pausedAt > 0, "Was not paused");

        s.pausedDuration += block.timestamp - s.pausedAt;
        s.pausedAt = 0;
        s.status = StreamStatus.Active;

        emit StreamResumed(streamId);
    }

    /**
     * @dev Cancel a stream. Refunds remaining to sponsor, pays earned to agent.
     */
    function cancelStream(uint256 streamId) external nonReentrant {
        Stream storage s = streams[streamId];
        require(s.sponsor == msg.sender, "Not sponsor");
        require(s.status != StreamStatus.Cancelled, "Already cancelled");

        uint256 earned = _clampEarned(s);
        uint256 agentPayout = earned - s.withdrawn;
        uint256 sponsorRefund = s.deposit - earned;

        s.status = StreamStatus.Cancelled;
        s.withdrawn = earned;

        if (agentPayout > 0) {
            uint256 fee = (agentPayout * protocolFeeBps) / 10000;
            uint256 net = agentPayout - fee;
            paymentToken.safeTransfer(s.agentWallet, net);
            if (fee > 0) {
                paymentToken.safeTransfer(treasury, fee);
                totalFeesCollected += fee;
            }
        }
        if (sponsorRefund > 0) {
            paymentToken.safeTransfer(s.sponsor, sponsorRefund);
        }

        emit StreamCancelled(streamId, sponsorRefund, agentPayout);
    }

    /**
     * @dev Agent withdraws accrued earnings.
     */
    function withdraw(uint256 streamId) external nonReentrant {
        Stream storage s = streams[streamId];
        require(s.agentWallet == msg.sender, "Not agent wallet");

        uint256 earned = _clampEarned(s);
        uint256 available = earned - s.withdrawn;
        require(available > 0, "Nothing to withdraw");

        uint256 fee = (available * protocolFeeBps) / 10000;
        uint256 net = available - fee;

        s.withdrawn = earned;
        s.lastWithdrawAt = block.timestamp;

        paymentToken.safeTransfer(s.agentWallet, net);
        if (fee > 0) {
            paymentToken.safeTransfer(treasury, fee);
            totalFeesCollected += fee;
        }

        // Check if stream is depleted
        if (earned >= s.deposit) {
            s.status = StreamStatus.Depleted;
        }

        emit Withdrawal(streamId, s.agentId, net, fee);
    }

    // --- View Functions ---

    /**
     * @dev Get how much an agent has earned (total) from a stream.
     */
    function getEarned(uint256 streamId) external view returns (uint256) {
        return _clampEarned(streams[streamId]);
    }

    /**
     * @dev Get how much an agent can withdraw right now.
     */
    function getWithdrawable(uint256 streamId) external view returns (uint256) {
        Stream storage s = streams[streamId];
        return _clampEarned(s) - s.withdrawn;
    }

    /**
     * @dev Get estimated time remaining before stream depletes.
     */
    function getTimeRemaining(uint256 streamId) external view returns (uint256) {
        Stream storage s = streams[streamId];
        if (s.status != StreamStatus.Active || s.ratePerSecond == 0) return 0;
        uint256 earned = _clampEarned(s);
        if (earned >= s.deposit) return 0;
        return (s.deposit - earned) / s.ratePerSecond;
    }

    /**
     * @dev Get all stream IDs for a sponsor.
     */
    function getSponsorStreamIds(address sponsor) external view returns (uint256[] memory) {
        return sponsorStreams[sponsor];
    }

    /**
     * @dev Get all stream IDs for an agent.
     */
    function getAgentStreamIds(bytes32 agentId) external view returns (uint256[] memory) {
        return agentStreams[agentId];
    }

    /**
     * @dev Get stream details.
     */
    function getStream(uint256 streamId) external view returns (Stream memory) {
        return streams[streamId];
    }

    // --- Admin ---

    function setProtocolFee(uint256 _feeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feeBps <= 500, "Max 5%");
        protocolFeeBps = _feeBps;
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }

    function pause() external onlyRole(OPERATOR_ROLE) { _pause(); }
    function unpause() external onlyRole(OPERATOR_ROLE) { _unpause(); }

    // --- Internal ---

    function _getEarned(Stream storage s) internal view returns (uint256) {
        if (s.status == StreamStatus.Cancelled) return s.withdrawn;

        uint256 effectiveEnd = block.timestamp;
        if (s.status == StreamStatus.Paused && s.pausedAt > 0) {
            effectiveEnd = s.pausedAt;
        }

        uint256 elapsed = effectiveEnd - s.startTime - s.pausedDuration;
        if (s.status == StreamStatus.Paused && s.pausedAt > 0) {
            // Don't subtract current pause since effectiveEnd = pausedAt
        }

        return elapsed * s.ratePerSecond;
    }

    function _clampEarned(Stream storage s) internal view returns (uint256) {
        uint256 earned = _getEarned(s);
        return earned > s.deposit ? s.deposit : earned;
    }
}
