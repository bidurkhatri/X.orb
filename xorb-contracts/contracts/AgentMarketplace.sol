// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AgentMarketplace
 * @dev Marketplace for hiring and renting AI agents in Xorb network.
 *
 * Sponsors can list their agents for hire. Other users can rent agents
 * with escrow-backed payments:
 *
 * - List agents with hourly/daily/task-based pricing
 * - Browse available agents by role, reputation, and price
 * - Hire with escrow (funds locked until task completion)
 * - Rate agents after engagement (affects reputation)
 * - Revenue split: agent owner gets paid, protocol takes fee
 *
 * This is the labor market of the Xorb network.
 */
contract AgentMarketplace is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");

    IERC20 public immutable paymentToken; // USDC

    // --- Types ---

    enum ListingStatus { Active, Paused, Delisted }
    enum EngagementStatus { Active, Completed, Disputed, Refunded, Cancelled }
    enum PricingModel { PerHour, PerDay, PerTask }

    struct Listing {
        uint256 listingId;
        address owner;            // agent's sponsor
        bytes32 agentId;
        uint256 pricePerUnit;     // USDC per hour/day/task
        PricingModel pricingModel;
        uint256 minReputation;    // minimum required reputation to list
        uint256 maxConcurrent;    // max simultaneous hires
        uint256 activeHires;      // current active engagements
        ListingStatus status;
        string description;       // what the agent can do
        uint256 totalEarned;      // lifetime earnings
        uint256 totalEngagements; // lifetime hire count
        uint256 avgRating;        // average rating (0-100, i.e. 85 = 4.25/5)
        uint256 createdAt;
    }

    struct Engagement {
        uint256 engagementId;
        uint256 listingId;
        address hirer;            // who hired the agent
        bytes32 agentId;
        uint256 escrowAmount;     // locked payment
        uint256 startedAt;
        uint256 completedAt;
        uint256 maxDuration;      // seconds, 0 = no limit
        EngagementStatus status;
        uint8 rating;             // 1-5 stars (0 = not rated)
        string taskDescription;
    }

    // --- Storage ---

    uint256 public nextListingId = 1;
    uint256 public nextEngagementId = 1;

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Engagement) public engagements;

    // Agent → listing ID (one listing per agent)
    mapping(bytes32 => uint256) public agentListing;
    // Owner → listing IDs
    mapping(address => uint256[]) public ownerListings;
    // Hirer → engagement IDs
    mapping(address => uint256[]) public hirerEngagements;

    // Protocol fee
    uint256 public protocolFeeBps = 250; // 2.5%
    address public treasury;
    uint256 public totalVolume;
    uint256 public totalFeesCollected;

    // --- Events ---

    event AgentListed(uint256 indexed listingId, address indexed owner, bytes32 indexed agentId, uint256 price, PricingModel model);
    event ListingUpdated(uint256 indexed listingId, uint256 newPrice, ListingStatus status);
    event AgentHired(uint256 indexed engagementId, uint256 indexed listingId, address indexed hirer, uint256 escrowAmount);
    event EngagementCompleted(uint256 indexed engagementId, uint256 paidToOwner, uint256 fee);
    event EngagementDisputed(uint256 indexed engagementId, address disputer);
    event DisputeResolved(uint256 indexed engagementId, uint256 refundToHirer, uint256 paidToOwner);
    event EngagementRated(uint256 indexed engagementId, uint8 rating);

    // --- Constructor ---

    constructor(address _token, address _treasury) {
        require(_token != address(0), "Invalid token");
        require(_treasury != address(0), "Invalid treasury");
        paymentToken = IERC20(_token);
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(ARBITER_ROLE, msg.sender);
    }

    // --- Listing Functions ---

    /**
     * @dev List an agent for hire on the marketplace.
     */
    function listAgent(
        bytes32 agentId,
        uint256 pricePerUnit,
        PricingModel pricingModel,
        uint256 minReputation,
        uint256 maxConcurrent,
        string calldata description
    ) external whenNotPaused returns (uint256 listingId) {
        require(agentId != bytes32(0), "Invalid agent");
        require(pricePerUnit > 0, "Price must be > 0");
        require(maxConcurrent > 0 && maxConcurrent <= 10, "1-10 concurrent");
        require(agentListing[agentId] == 0, "Agent already listed");

        listingId = nextListingId++;
        listings[listingId] = Listing({
            listingId: listingId,
            owner: msg.sender,
            agentId: agentId,
            pricePerUnit: pricePerUnit,
            pricingModel: pricingModel,
            minReputation: minReputation,
            maxConcurrent: maxConcurrent,
            activeHires: 0,
            status: ListingStatus.Active,
            description: description,
            totalEarned: 0,
            totalEngagements: 0,
            avgRating: 0,
            createdAt: block.timestamp
        });

        agentListing[agentId] = listingId;
        ownerListings[msg.sender].push(listingId);

        emit AgentListed(listingId, msg.sender, agentId, pricePerUnit, pricingModel);
    }

    /**
     * @dev Update listing price or status.
     */
    function updateListing(uint256 listingId, uint256 newPrice, ListingStatus newStatus) external {
        Listing storage l = listings[listingId];
        require(l.owner == msg.sender, "Not owner");
        require(l.status != ListingStatus.Delisted, "Already delisted");

        if (newPrice > 0) l.pricePerUnit = newPrice;
        l.status = newStatus;

        if (newStatus == ListingStatus.Delisted) {
            agentListing[l.agentId] = 0;
        }

        emit ListingUpdated(listingId, l.pricePerUnit, l.status);
    }

    // --- Hiring Functions ---

    /**
     * @dev Hire an agent. Payment goes into escrow.
     * @param listingId The listing to hire from
     * @param units Number of hours/days/tasks to pay for
     * @param maxDuration Max seconds the engagement can last (0 = no limit)
     * @param taskDescription What the hirer wants the agent to do
     */
    function hireAgent(
        uint256 listingId,
        uint256 units,
        uint256 maxDuration,
        string calldata taskDescription
    ) external nonReentrant whenNotPaused returns (uint256 engagementId) {
        Listing storage l = listings[listingId];
        require(l.status == ListingStatus.Active, "Listing not active");
        require(l.activeHires < l.maxConcurrent, "Fully booked");
        require(l.owner != msg.sender, "Cannot hire own agent");
        require(units > 0, "Units must be > 0");

        uint256 escrow = l.pricePerUnit * units;
        require(escrow > 0, "Escrow too small");

        // Lock payment in escrow
        paymentToken.safeTransferFrom(msg.sender, address(this), escrow);

        engagementId = nextEngagementId++;
        engagements[engagementId] = Engagement({
            engagementId: engagementId,
            listingId: listingId,
            hirer: msg.sender,
            agentId: l.agentId,
            escrowAmount: escrow,
            startedAt: block.timestamp,
            completedAt: 0,
            maxDuration: maxDuration,
            status: EngagementStatus.Active,
            rating: 0,
            taskDescription: taskDescription
        });

        l.activeHires++;
        hirerEngagements[msg.sender].push(engagementId);

        emit AgentHired(engagementId, listingId, msg.sender, escrow);
    }

    /**
     * @dev Complete an engagement. Either hirer confirms completion or owner marks done.
     */
    function completeEngagement(uint256 engagementId) external nonReentrant {
        Engagement storage e = engagements[engagementId];
        Listing storage l = listings[e.listingId];
        require(e.status == EngagementStatus.Active, "Not active");
        require(msg.sender == e.hirer || msg.sender == l.owner, "Not authorized");

        e.status = EngagementStatus.Completed;
        e.completedAt = block.timestamp;
        l.activeHires--;
        l.totalEngagements++;

        // Pay owner (minus protocol fee)
        uint256 fee = (e.escrowAmount * protocolFeeBps) / 10000;
        uint256 ownerPayout = e.escrowAmount - fee;

        paymentToken.safeTransfer(l.owner, ownerPayout);
        if (fee > 0) {
            paymentToken.safeTransfer(treasury, fee);
            totalFeesCollected += fee;
        }

        l.totalEarned += ownerPayout;
        totalVolume += e.escrowAmount;

        emit EngagementCompleted(engagementId, ownerPayout, fee);
    }

    /**
     * @dev Dispute an engagement. Locks funds pending arbitration.
     */
    function disputeEngagement(uint256 engagementId) external {
        Engagement storage e = engagements[engagementId];
        require(e.status == EngagementStatus.Active, "Not active");
        require(msg.sender == e.hirer, "Only hirer can dispute");

        e.status = EngagementStatus.Disputed;
        emit EngagementDisputed(engagementId, msg.sender);
    }

    /**
     * @dev Resolve a dispute (arbiter only). Splits funds between hirer and owner.
     * @param refundPercent 0-100, percentage refunded to hirer. Rest goes to owner.
     */
    function resolveDispute(uint256 engagementId, uint256 refundPercent) external nonReentrant onlyRole(ARBITER_ROLE) {
        Engagement storage e = engagements[engagementId];
        Listing storage l = listings[e.listingId];
        require(e.status == EngagementStatus.Disputed, "Not disputed");
        require(refundPercent <= 100, "Invalid percent");

        uint256 refundAmount = (e.escrowAmount * refundPercent) / 100;
        uint256 ownerAmount = e.escrowAmount - refundAmount;

        e.status = refundPercent == 100 ? EngagementStatus.Refunded : EngagementStatus.Completed;
        e.completedAt = block.timestamp;
        l.activeHires--;

        if (refundAmount > 0) {
            paymentToken.safeTransfer(e.hirer, refundAmount);
        }
        if (ownerAmount > 0) {
            uint256 fee = (ownerAmount * protocolFeeBps) / 10000;
            uint256 net = ownerAmount - fee;
            paymentToken.safeTransfer(l.owner, net);
            if (fee > 0) {
                paymentToken.safeTransfer(treasury, fee);
                totalFeesCollected += fee;
            }
            l.totalEarned += net;
            totalVolume += ownerAmount;
        }

        emit DisputeResolved(engagementId, refundAmount, ownerAmount);
    }

    /**
     * @dev Cancel an active engagement (hirer only, before completion).
     * Hirer gets a partial refund based on time elapsed.
     */
    function cancelEngagement(uint256 engagementId) external nonReentrant {
        Engagement storage e = engagements[engagementId];
        Listing storage l = listings[e.listingId];
        require(e.status == EngagementStatus.Active, "Not active");
        require(msg.sender == e.hirer, "Only hirer");

        e.status = EngagementStatus.Cancelled;
        e.completedAt = block.timestamp;
        l.activeHires--;

        // Calculate pro-rata refund
        uint256 elapsed = block.timestamp - e.startedAt;
        uint256 totalDuration = e.maxDuration > 0 ? e.maxDuration : 86400; // default 1 day
        uint256 usedFraction = elapsed >= totalDuration ? 100 : (elapsed * 100) / totalDuration;
        uint256 ownerShare = (e.escrowAmount * usedFraction) / 100;
        uint256 refund = e.escrowAmount - ownerShare;

        if (ownerShare > 0) {
            uint256 fee = (ownerShare * protocolFeeBps) / 10000;
            uint256 net = ownerShare - fee;
            paymentToken.safeTransfer(l.owner, net);
            if (fee > 0) {
                paymentToken.safeTransfer(treasury, fee);
                totalFeesCollected += fee;
            }
            l.totalEarned += net;
            totalVolume += ownerShare;
        }
        if (refund > 0) {
            paymentToken.safeTransfer(e.hirer, refund);
        }

        emit EngagementCompleted(engagementId, ownerShare, 0);
    }

    /**
     * @dev Rate a completed engagement (hirer only).
     */
    function rateEngagement(uint256 engagementId, uint8 rating) external {
        Engagement storage e = engagements[engagementId];
        require(msg.sender == e.hirer, "Only hirer");
        require(e.status == EngagementStatus.Completed, "Not completed");
        require(rating >= 1 && rating <= 5, "Rating 1-5");
        require(e.rating == 0, "Already rated");

        e.rating = rating;

        // Update listing average rating (rolling average * 20 for 0-100 scale)
        Listing storage l = listings[e.listingId];
        uint256 ratingScaled = uint256(rating) * 20; // 1-5 → 20-100
        if (l.avgRating == 0) {
            l.avgRating = ratingScaled;
        } else {
            // Exponential moving average (weight new rating 20%)
            l.avgRating = (l.avgRating * 80 + ratingScaled * 20) / 100;
        }

        emit EngagementRated(engagementId, rating);
    }

    // --- View Functions ---

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    function getEngagement(uint256 engagementId) external view returns (Engagement memory) {
        return engagements[engagementId];
    }

    function getOwnerListingIds(address owner) external view returns (uint256[] memory) {
        return ownerListings[owner];
    }

    function getHirerEngagementIds(address hirer) external view returns (uint256[] memory) {
        return hirerEngagements[hirer];
    }

    function isAgentAvailable(uint256 listingId) external view returns (bool) {
        Listing storage l = listings[listingId];
        return l.status == ListingStatus.Active && l.activeHires < l.maxConcurrent;
    }

    // --- Admin ---

    function setProtocolFee(uint256 _feeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feeBps <= 1000, "Max 10%");
        protocolFeeBps = _feeBps;
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }

    function pause() external onlyRole(OPERATOR_ROLE) { _pause(); }
    function unpause() external onlyRole(OPERATOR_ROLE) { _unpause(); }
}
