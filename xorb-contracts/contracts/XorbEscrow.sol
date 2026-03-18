// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title XorbEscrow
 * @dev Unified USDC escrow for X.orb — handles agent bonds, marketplace
 *      escrow, and payment stream deposits.
 *
 * Escrow Types:
 *   BOND     — Agent registration bond. Slashable by SlashingEngine.
 *   ESCROW   — Marketplace hire payment. Released on completion or refunded on dispute.
 *   STREAM   — Payment stream deposit. Drawn down over time by PaymentStreaming.
 *
 * Key features:
 *   - USDC deposits with sponsor authorization
 *   - Conditional release based on smart contract conditions
 *   - Emergency withdrawal by sponsor (with time-lock for active engagements)
 *   - x402 facilitator whitelisting
 *   - Protocol fee collection (configurable, default 2%)
 */
contract XorbEscrow is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");
    bytes32 public constant FACILITATOR_ROLE = keccak256("FACILITATOR_ROLE");

    IERC20 public immutable usdc;

    // --- Types ---

    enum EscrowType { BOND, ESCROW, STREAM }
    enum EscrowStatus { Active, Released, Slashed, Refunded, TimeLocked }

    struct EscrowRecord {
        uint256 escrowId;
        EscrowType escrowType;
        address depositor;          // sponsor or hirer
        bytes32 agentId;            // associated agent
        uint256 amount;             // USDC amount deposited
        uint256 released;           // amount already released
        uint256 slashed;            // amount slashed
        EscrowStatus status;
        uint256 createdAt;
        uint256 expiresAt;          // 0 = no expiry
        uint256 timeLockUntil;      // 0 = not time-locked
    }

    // --- Storage ---

    uint256 public nextEscrowId = 1;
    mapping(uint256 => EscrowRecord) public escrows;
    mapping(address => uint256[]) public depositorEscrows;
    mapping(bytes32 => uint256[]) public agentEscrows;

    // Protocol fee in basis points (200 = 2%)
    uint256 public protocolFeeBps = 200;
    address public protocolTreasury;
    uint256 public totalProtocolFees;

    // x402 facilitator whitelist
    mapping(address => bool) public whitelistedFacilitators;

    // --- Events ---

    event EscrowDeposited(uint256 indexed escrowId, EscrowType escrowType, address indexed depositor, bytes32 indexed agentId, uint256 amount);
    event EscrowReleased(uint256 indexed escrowId, address recipient, uint256 amount);
    event EscrowSlashed(uint256 indexed escrowId, uint256 amount, address recipient);
    event EscrowRefunded(uint256 indexed escrowId, address depositor, uint256 amount);
    event ProtocolFeeCollected(uint256 indexed escrowId, uint256 feeAmount);
    event FacilitatorUpdated(address facilitator, bool whitelisted);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // --- Constructor ---

    constructor(address _usdc, address _treasury) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_treasury != address(0), "Invalid treasury address");
        usdc = IERC20(_usdc);
        protocolTreasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    // --- Core Functions ---

    /**
     * @dev Deposit USDC into escrow.
     * @param escrowType Type of escrow (BOND, ESCROW, STREAM)
     * @param agentId Associated agent
     * @param amount USDC amount (6 decimals)
     * @param expiresAt Expiry timestamp (0 for no expiry)
     */
    function deposit(
        EscrowType escrowType,
        bytes32 agentId,
        uint256 amount,
        uint256 expiresAt
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(amount > 0, "Amount must be > 0");

        uint256 escrowId = nextEscrowId++;
        escrows[escrowId] = EscrowRecord({
            escrowId: escrowId,
            escrowType: escrowType,
            depositor: msg.sender,
            agentId: agentId,
            amount: amount,
            released: 0,
            slashed: 0,
            status: EscrowStatus.Active,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            timeLockUntil: 0
        });

        depositorEscrows[msg.sender].push(escrowId);
        agentEscrows[agentId].push(escrowId);

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit EscrowDeposited(escrowId, escrowType, msg.sender, agentId, amount);
        return escrowId;
    }

    /**
     * @dev Release escrow funds to a recipient. Deducts protocol fee.
     * @param escrowId Escrow to release from
     * @param recipient Address to receive funds
     * @param amount Amount to release
     */
    function release(
        uint256 escrowId,
        address recipient,
        uint256 amount
    ) external nonReentrant onlyRole(OPERATOR_ROLE) {
        EscrowRecord storage record = escrows[escrowId];
        require(record.status == EscrowStatus.Active, "Escrow not active");
        require(record.amount - record.released - record.slashed >= amount, "Insufficient escrow balance");

        // Calculate protocol fee
        uint256 fee = (amount * protocolFeeBps) / 10000;
        uint256 netAmount = amount - fee;

        record.released += amount;

        // Check if fully released
        if (record.released + record.slashed >= record.amount) {
            record.status = EscrowStatus.Released;
        }

        usdc.safeTransfer(recipient, netAmount);
        if (fee > 0) {
            usdc.safeTransfer(protocolTreasury, fee);
            totalProtocolFees += fee;
            emit ProtocolFeeCollected(escrowId, fee);
        }

        emit EscrowReleased(escrowId, recipient, netAmount);
    }

    /**
     * @dev Slash escrow funds (for violations). Funds go to treasury + sponsor split.
     * @param escrowId Escrow to slash
     * @param amount Amount to slash
     */
    function slash(
        uint256 escrowId,
        uint256 amount
    ) external nonReentrant onlyRole(SLASHER_ROLE) {
        EscrowRecord storage record = escrows[escrowId];
        require(record.status == EscrowStatus.Active, "Escrow not active");
        require(record.amount - record.released - record.slashed >= amount, "Insufficient balance to slash");

        record.slashed += amount;

        // 50% to sponsor (partial refund), 50% to protocol treasury
        uint256 sponsorShare = amount / 2;
        uint256 treasuryShare = amount - sponsorShare;

        usdc.safeTransfer(record.depositor, sponsorShare);
        usdc.safeTransfer(protocolTreasury, treasuryShare);

        // Check if fully slashed
        if (record.released + record.slashed >= record.amount) {
            record.status = EscrowStatus.Slashed;
        }

        emit EscrowSlashed(escrowId, amount, record.depositor);
    }

    /**
     * @dev Refund remaining escrow to depositor. Only for non-time-locked escrows.
     */
    function refund(uint256 escrowId) external nonReentrant {
        EscrowRecord storage record = escrows[escrowId];
        require(record.depositor == msg.sender || hasRole(OPERATOR_ROLE, msg.sender), "Not authorized");
        require(record.status == EscrowStatus.Active, "Escrow not active");
        require(record.timeLockUntil == 0 || block.timestamp > record.timeLockUntil, "Time-locked");

        uint256 remaining = record.amount - record.released - record.slashed;
        require(remaining > 0, "Nothing to refund");

        record.status = EscrowStatus.Refunded;
        usdc.safeTransfer(record.depositor, remaining);

        emit EscrowRefunded(escrowId, record.depositor, remaining);
    }

    // --- Time Lock ---

    function setTimeLock(uint256 escrowId, uint256 until) external onlyRole(OPERATOR_ROLE) {
        escrows[escrowId].timeLockUntil = until;
    }

    // --- x402 Facilitator Management ---

    function setFacilitator(address facilitator, bool whitelisted) external onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelistedFacilitators[facilitator] = whitelisted;
        emit FacilitatorUpdated(facilitator, whitelisted);
    }

    /**
     * @dev Deposit via x402 facilitator (gasless for the user).
     */
    function facilitatorDeposit(
        EscrowType escrowType,
        address depositor,
        bytes32 agentId,
        uint256 amount,
        uint256 expiresAt
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(whitelistedFacilitators[msg.sender], "Not a whitelisted facilitator");
        require(amount > 0, "Amount must be > 0");

        uint256 escrowId = nextEscrowId++;
        escrows[escrowId] = EscrowRecord({
            escrowId: escrowId,
            escrowType: escrowType,
            depositor: depositor,
            agentId: agentId,
            amount: amount,
            released: 0,
            slashed: 0,
            status: EscrowStatus.Active,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            timeLockUntil: 0
        });

        depositorEscrows[depositor].push(escrowId);
        agentEscrows[agentId].push(escrowId);

        // Facilitator transfers USDC on behalf of depositor
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit EscrowDeposited(escrowId, escrowType, depositor, agentId, amount);
        return escrowId;
    }

    // --- Admin ---

    function setProtocolFee(uint256 feeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(feeBps <= 1000, "Fee too high"); // Max 10%
        protocolFeeBps = feeBps;
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "Invalid treasury");
        address old = protocolTreasury;
        protocolTreasury = _treasury;
        emit TreasuryUpdated(old, _treasury);
    }

    function pause() external onlyRole(OPERATOR_ROLE) { _pause(); }
    function unpause() external onlyRole(OPERATOR_ROLE) { _unpause(); }

    // --- Views ---

    function getEscrow(uint256 escrowId) external view returns (EscrowRecord memory) {
        return escrows[escrowId];
    }

    function getDepositorEscrows(address depositor) external view returns (uint256[] memory) {
        return depositorEscrows[depositor];
    }

    function getAgentEscrows(bytes32 agentId) external view returns (uint256[] memory) {
        return agentEscrows[agentId];
    }

    function getAvailableBalance(uint256 escrowId) external view returns (uint256) {
        EscrowRecord storage record = escrows[escrowId];
        if (record.status != EscrowStatus.Active) return 0;
        return record.amount - record.released - record.slashed;
    }
}
