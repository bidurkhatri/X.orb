// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title XorbPaymentSplitter
 * @dev Atomic USDC fee splitting for the X.orb payment pipeline.
 *
 * Two modes:
 * 1. Immediate: processPayment() — collect, split, forward in one tx
 * 2. Batch: collectAndQueue() + settleBatch() — cheaper gas for high volume
 *
 * Security features:
 * - Per-payment max cap (prevents drain if facilitator key compromised)
 * - Daily spending limit
 * - Sponsor self-set daily caps
 * - Refunds only to original payer for original amount
 * - Treasury change has 24h timelock
 * - Emergency pause
 */
contract XorbPaymentSplitter is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public treasury;
    uint256 public defaultFeeBps;

    // Security limits
    uint256 public maxSinglePayment = 10_000 * 1e6; // $10,000 USDC max per payment
    uint256 public dailySpendLimit = 100_000 * 1e6;  // $100,000/day
    mapping(uint256 => uint256) public dailySpent;    // day => total spent
    uint256 public constant MAX_BATCH_SIZE = 100;

    // Sponsor self-set daily caps
    mapping(address => uint256) public sponsorDailyCap;
    mapping(uint256 => mapping(address => uint256)) public sponsorDailySpent;

    // Treasury timelock
    address public pendingTreasury;
    uint256 public treasuryChangeTime;
    uint256 public constant TREASURY_TIMELOCK = 24 hours;

    // Pending settlement tracking
    struct PendingPayment {
        address payer;
        address recipient;
        uint256 grossAmount;
        uint256 feeAmount;
        uint256 netAmount;
        bytes32 actionId;
        bool settled;
        bool refunded;
    }

    mapping(bytes32 => PendingPayment) public pendingPayments;
    bytes32[] public pendingQueue;

    // Events
    event PaymentProcessed(
        address indexed payer, address indexed recipient,
        uint256 grossAmount, uint256 feeAmount, uint256 netAmount,
        bytes32 indexed actionId
    );
    event PaymentQueued(
        address indexed payer, address indexed recipient,
        uint256 grossAmount, bytes32 indexed actionId
    );
    event BatchSettled(uint256 count, uint256 totalFees, uint256 totalNet);
    event Refunded(address indexed payer, uint256 amount, bytes32 indexed actionId);
    event FeeUpdated(uint256 oldBps, uint256 newBps);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event TreasuryChangeProposed(address indexed newTreasury, uint256 executeAfter);
    event SponsorCapSet(address indexed sponsor, uint256 dailyCap);

    constructor(address _usdc, address _treasury, uint256 _feeBps) {
        require(_usdc != address(0), "Invalid USDC");
        require(_treasury != address(0), "Invalid treasury");
        require(_feeBps <= 1000, "Max 10%");

        usdc = IERC20(_usdc);
        treasury = _treasury;
        defaultFeeBps = _feeBps;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // --- Immediate Mode ---

    /// @notice Collect, split, and forward in one atomic tx
    function processPayment(
        address payer, address recipient,
        uint256 grossAmount, bytes32 actionId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant whenNotPaused
      returns (uint256 feeAmount, uint256 netAmount)
    {
        require(grossAmount > 0, "Zero amount");
        require(recipient != address(0), "Zero recipient");
        require(grossAmount <= maxSinglePayment, "Exceeds single payment limit");

        _checkDailyLimit(grossAmount);
        _checkSponsorCap(payer, grossAmount);

        feeAmount = (grossAmount * defaultFeeBps) / 10000;
        netAmount = grossAmount - feeAmount;

        usdc.safeTransferFrom(payer, address(this), grossAmount);
        if (feeAmount > 0) usdc.safeTransfer(treasury, feeAmount);
        if (netAmount > 0) usdc.safeTransfer(recipient, netAmount);

        emit PaymentProcessed(payer, recipient, grossAmount, feeAmount, netAmount, actionId);
    }

    // --- Batch Mode ---

    /// @notice Collect from payer and hold for batch settlement
    function collectAndQueue(
        address payer, address recipient,
        uint256 grossAmount, uint256 feeBps, bytes32 actionId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant whenNotPaused {
        require(grossAmount > 0, "Zero amount");
        require(grossAmount <= maxSinglePayment, "Exceeds single payment limit");
        require(pendingPayments[actionId].grossAmount == 0, "Duplicate actionId");

        _checkDailyLimit(grossAmount);
        _checkSponsorCap(payer, grossAmount);

        uint256 feeAmount = (grossAmount * feeBps) / 10000;
        uint256 netAmount = grossAmount - feeAmount;

        usdc.safeTransferFrom(payer, address(this), grossAmount);

        pendingPayments[actionId] = PendingPayment({
            payer: payer,
            recipient: recipient,
            grossAmount: grossAmount,
            feeAmount: feeAmount,
            netAmount: netAmount,
            actionId: actionId,
            settled: false,
            refunded: false
        });
        pendingQueue.push(actionId);

        emit PaymentQueued(payer, recipient, grossAmount, actionId);
    }

    /// @notice Settle pending payments in batches
    /// @param maxCount Max payments to settle (0 = MAX_BATCH_SIZE)
    function settleBatch(uint256 maxCount) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        uint256 toProcess = maxCount > 0 ? maxCount : MAX_BATCH_SIZE;
        uint256 totalFees = 0;
        uint256 totalNet = 0;
        uint256 settled = 0;

        for (uint256 i = 0; i < pendingQueue.length && settled < toProcess; i++) {
            PendingPayment storage p = pendingPayments[pendingQueue[i]];
            if (p.settled || p.refunded) continue;

            if (p.netAmount > 0) {
                usdc.safeTransfer(p.recipient, p.netAmount);
            }
            totalFees += p.feeAmount;
            totalNet += p.netAmount;
            p.settled = true;
            settled++;

            emit PaymentProcessed(
                p.payer, p.recipient,
                p.grossAmount, p.feeAmount, p.netAmount,
                p.actionId
            );
        }

        if (totalFees > 0) {
            usdc.safeTransfer(treasury, totalFees);
        }

        // Clean up settled entries from the front
        _cleanQueue();

        emit BatchSettled(settled, totalFees, totalNet);
    }

    // --- Refunds (SEC-1: only to original payer, only original amount) ---

    /// @notice Refund a queued payment. Only to original payer, only original amount.
    function refundQueued(bytes32 actionId) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        PendingPayment storage p = pendingPayments[actionId];
        require(p.grossAmount > 0, "No such payment");
        require(!p.settled, "Already settled");
        require(!p.refunded, "Already refunded");

        p.refunded = true;
        usdc.safeTransfer(p.payer, p.grossAmount);

        emit Refunded(p.payer, p.grossAmount, actionId);
    }

    // --- Sponsor Self-Set Caps (SEC-4) ---

    /// @notice Sponsors set their own daily spending cap
    function setSponsorDailyCap(uint256 cap) external {
        sponsorDailyCap[msg.sender] = cap;
        emit SponsorCapSet(msg.sender, cap);
    }

    // --- View Functions ---

    function pendingCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < pendingQueue.length; i++) {
            PendingPayment storage p = pendingPayments[pendingQueue[i]];
            if (!p.settled && !p.refunded) count++;
        }
    }

    function getPayment(bytes32 actionId) external view returns (PendingPayment memory) {
        return pendingPayments[actionId];
    }

    // --- Admin Functions ---

    function setFeeBasisPoints(uint256 _newBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newBps <= 1000, "Max 10%");
        emit FeeUpdated(defaultFeeBps, _newBps);
        defaultFeeBps = _newBps;
    }

    function setMaxSinglePayment(uint256 _max) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxSinglePayment = _max;
    }

    function setDailySpendLimit(uint256 _limit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        dailySpendLimit = _limit;
    }

    /// @notice Propose treasury change (24h timelock)
    function proposeTreasuryChange(address _new) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_new != address(0), "Invalid address");
        pendingTreasury = _new;
        treasuryChangeTime = block.timestamp + TREASURY_TIMELOCK;
        emit TreasuryChangeProposed(_new, treasuryChangeTime);
    }

    /// @notice Execute treasury change after timelock expires
    function executeTreasuryChange() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(block.timestamp >= treasuryChangeTime, "Timelock active");
        require(pendingTreasury != address(0), "No pending change");
        emit TreasuryUpdated(treasury, pendingTreasury);
        treasury = pendingTreasury;
        pendingTreasury = address(0);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    // --- Internal ---

    function _checkDailyLimit(uint256 amount) internal {
        uint256 today = block.timestamp / 86400;
        require(dailySpent[today] + amount <= dailySpendLimit, "Daily limit exceeded");
        dailySpent[today] += amount;
    }

    function _checkSponsorCap(address sponsor, uint256 amount) internal {
        if (sponsorDailyCap[sponsor] > 0) {
            uint256 today = block.timestamp / 86400;
            require(
                sponsorDailySpent[today][sponsor] + amount <= sponsorDailyCap[sponsor],
                "Sponsor daily cap exceeded"
            );
            sponsorDailySpent[today][sponsor] += amount;
        }
    }

    function _cleanQueue() internal {
        uint256 cleaned = 0;
        for (uint256 i = 0; i < pendingQueue.length; i++) {
            PendingPayment storage p = pendingPayments[pendingQueue[i]];
            if (p.settled || p.refunded) {
                cleaned++;
            } else {
                break; // Stop at first unsettled
            }
        }
        if (cleaned > 0) {
            // Shift array left
            for (uint256 i = 0; i < pendingQueue.length - cleaned; i++) {
                pendingQueue[i] = pendingQueue[i + cleaned];
            }
            for (uint256 i = 0; i < cleaned; i++) {
                pendingQueue.pop();
            }
        }
    }
}
