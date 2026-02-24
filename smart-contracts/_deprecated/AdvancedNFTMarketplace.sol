// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title AdvancedNFTMarketplace
 * @dev Comprehensive NFT marketplace supporting ERC721 and ERC1155 with auctions
 */
contract AdvancedNFTMarketplace is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    using Math for uint256;

    // Events
    event NFTListed(
        bytes32 indexed listingId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 price,
        NFTStandard standard
    );

    event NFTSold(
        bytes32 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 price,
        NFTStandard standard
    );

    event ListingCanceled(
        bytes32 indexed listingId,
        address indexed seller
    );

    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 startPrice,
        uint256 reservePrice,
        uint256 endTime
    );

    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 bid,
        bool isReplaced
    );

    event AuctionSettled(
        uint256 indexed auctionId,
        address indexed winner,
        address indexed seller,
        uint256 winningBid,
        bool reserveMet
    );

    event OfferMade(
        bytes32 indexed offerId,
        address indexed buyer,
        address indexed nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 price
    );

    event OfferAccepted(
        bytes32 indexed offerId,
        address indexed seller,
        address indexed buyer
    );

    // Structs
    enum NFTStandard { ERC721, ERC1155 }
    enum ListingStatus { ACTIVE, SOLD, CANCELED, EXPIRED }
    enum AuctionStatus { ACTIVE, SETTLED, CANCELED }
    enum OfferStatus { PENDING, ACCEPTED, CANCELED, EXPIRED }

    struct Listing {
        address nftContract;
        uint256 tokenId;
        uint256 amount;
        uint256 price;
        address seller;
        NFTStandard standard;
        ListingStatus status;
        uint256 createdAt;
        uint256 expiresAt;
        bytes32 listingHash;
    }

    struct Auction {
        address nftContract;
        uint256 tokenId;
        uint256 startPrice;
        uint256 reservePrice;
        address seller;
        address highestBidder;
        uint256 highestBid;
        uint256 endTime;
        NFTStandard standard;
        AuctionStatus status;
        uint256 createdAt;
        uint256 minBidIncrement;
        bool reserveMet;
    }

    struct Offer {
        address nftContract;
        uint256 tokenId;
        uint256 amount;
        address buyer;
        uint256 price;
        address paymentToken;
        OfferStatus status;
        uint256 createdAt;
        uint256 expiresAt;
        address seller;
    }

    // State variables
    mapping(bytes32 => Listing) public listings;
    mapping(uint256 => Auction) public auctions;
    mapping(bytes32 => Offer) public offers;
    
    // User analytics
    mapping(address => uint256) public userListingsCount;
    mapping(address => uint256) public userSalesCount;
    mapping(address => uint256) public userPurchasesCount;
    mapping(address => uint256) public userTotalVolume;
    mapping(address => bool) public authorizedNFTs;
    
    // Marketplace configuration
    uint256 public marketplaceFee = 250; // 2.5%
    uint256 public minimumBidIncrement = 10000000000000000; // 0.01 ETH
    uint256 public maximumAuctionDuration = 7 days;
    uint256 public minimumAuctionDuration = 1 hours;
    uint256 public maximumListingDuration = 30 days;
    uint256 public minimumListingDuration = 1 hours;
    
    address public feeRecipient;
    mapping(address => uint256) public protocolFees;
    
    // Counters
    uint256 public nextAuctionId = 1;
    uint256 public totalVolume;
    uint256 public totalSales;
    
    // Modifiers
    modifier onlyAuthorizedNFT(address nftContract) {
        require(authorizedNFTs[nftContract] || msg.sender == owner(), "NFT not authorized");
        _;
    }
    
    modifier validListingDuration(uint256 duration) {
        require(duration >= minimumListingDuration && duration <= maximumListingDuration, "Invalid duration");
        _;
    }
    
    modifier validAuctionDuration(uint256 duration) {
        require(duration >= minimumAuctionDuration && duration <= maximumAuctionDuration, "Invalid duration");
        _;
    }

    constructor(address _feeRecipient) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
        
        // Authorize some example NFT contracts
        authorizedNFTs[0xA0b86a33E6411b8b7ce9c3a8b6C0C3C5a7F9d8c2] = true;
        authorizedNFTs[0xB0b86a33E6411b8b7ce9c3a8b6C0C3C5a7F9d8c3] = true;
    }

    /**
     * @dev List ERC721 NFT for sale
     */
    function listERC721(
        address nftContract,
        uint256 tokenId,
        uint256 price,
        uint256 duration
    ) external whenNotPaused onlyAuthorizedNFT(nftContract) validListingDuration(duration) nonReentrant {
        require(price > 0, "Invalid price");
        
        bytes32 listingId = _getListingId(msg.sender, nftContract, tokenId, 1, block.timestamp);
        
        listings[listingId] = Listing({
            nftContract: nftContract,
            tokenId: tokenId,
            amount: 1,
            price: price,
            seller: msg.sender,
            standard: NFTStandard.ERC721,
            status: ListingStatus.ACTIVE,
            createdAt: block.timestamp,
            expiresAt: block.timestamp.add(duration),
            listingHash: listingId
        });
        
        // Transfer NFT to marketplace
        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);
        
        userListingsCount[msg.sender] = userListingsCount[msg.sender].add(1);
        
        emit NFTListed(listingId, msg.sender, nftContract, tokenId, 1, price, NFTStandard.ERC721);
    }

    /**
     * @dev List ERC1155 NFT for sale
     */
    function listERC1155(
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 price,
        uint256 duration
    ) external whenNotPaused onlyAuthorizedNFT(nftContract) validListingDuration(duration) nonReentrant {
        require(price > 0, "Invalid price");
        require(amount > 0, "Invalid amount");
        
        bytes32 listingId = _getListingId(msg.sender, nftContract, tokenId, amount, block.timestamp);
        
        listings[listingId] = Listing({
            nftContract: nftContract,
            tokenId: tokenId,
            amount: amount,
            price: price,
            seller: msg.sender,
            standard: NFTStandard.ERC1155,
            status: ListingStatus.ACTIVE,
            createdAt: block.timestamp,
            expiresAt: block.timestamp.add(duration),
            listingHash: listingId
        });
        
        // Transfer NFT to marketplace
        IERC1155(nftContract).safeTransferFrom(msg.sender, address(this), tokenId, amount, "");
        
        userListingsCount[msg.sender] = userListingsCount[msg.sender].add(1);
        
        emit NFTListed(listingId, msg.sender, nftContract, tokenId, amount, price, NFTStandard.ERC1155);
    }

    /**
     * @dev Buy NFT from listing
     */
    function buyNFT(bytes32 listingId) external payable whenNotPaused nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.status == ListingStatus.ACTIVE, "Listing not active");
        require(block.timestamp <= listing.expiresAt, "Listing expired");
        require(msg.sender != listing.seller, "Cannot buy own NFT");
        
        uint256 totalPrice = listing.price;
        require(msg.value >= totalPrice, "Insufficient payment");
        
        // Calculate fees
        uint256 fee = totalPrice.mul(marketplaceFee).div(10000);
        uint256 sellerAmount = totalPrice.sub(fee);
        
        // Update listing
        listing.status = ListingStatus.SOLD;
        
        // Update user statistics
        userPurchasesCount[msg.sender] = userPurchasesCount[msg.sender].add(1);
        userSalesCount[listing.seller] = userSalesCount[listing.seller].add(1);
        userTotalVolume[msg.sender] = userTotalVolume[msg.sender].add(totalPrice);
        userTotalVolume[listing.seller] = userTotalVolume[listing.seller].add(totalPrice);
        totalVolume = totalVolume.add(totalPrice);
        totalSales = totalSales.add(1);
        protocolFees[address(0)] = protocolFees[address(0)].add(fee);
        
        // Transfer NFT
        if (listing.standard == NFTStandard.ERC721) {
            IERC721(listing.nftContract).transferFrom(address(this), msg.sender, listing.tokenId);
        } else {
            IERC1155(listing.nftContract).safeTransferFrom(
                address(this),
                msg.sender,
                listing.tokenId,
                listing.amount,
                ""
            );
        }
        
        // Transfer payments
        payable(listing.seller).transfer(sellerAmount);
        payable(feeRecipient).transfer(fee);
        
        // Refund excess
        if (msg.value > totalPrice) {
            payable(msg.sender).transfer(msg.value - totalPrice);
        }
        
        emit NFTSold(listingId, msg.sender, listing.seller, listing.amount, totalPrice, listing.standard);
    }

    /**
     * @dev Buy NFT with ERC20 token
     */
    function buyNFTWithToken(bytes32 listingId, address paymentToken) external whenNotPaused nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.status == ListingStatus.ACTIVE, "Listing not active");
        require(block.timestamp <= listing.expiresAt, "Listing expired");
        require(msg.sender != listing.seller, "Cannot buy own NFT");
        require(paymentToken != address(0), "Invalid payment token");
        
        uint256 totalPrice = listing.price;
        
        // Calculate fees
        uint256 fee = totalPrice.mul(marketplaceFee).div(10000);
        uint256 sellerAmount = totalPrice.sub(fee);
        
        // Update listing
        listing.status = ListingStatus.SOLD;
        
        // Update user statistics
        userPurchasesCount[msg.sender] = userPurchasesCount[msg.sender].add(1);
        userSalesCount[listing.seller] = userSalesCount[listing.seller].add(1);
        userTotalVolume[msg.sender] = userTotalVolume[msg.sender].add(totalPrice);
        userTotalVolume[listing.seller] = userTotalVolume[listing.seller].add(totalPrice);
        totalVolume = totalVolume.add(totalPrice);
        totalSales = totalSales.add(1);
        protocolFees[paymentToken] = protocolFees[paymentToken].add(fee);
        
        // Transfer payment token
        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), totalPrice);
        
        // Transfer NFT
        if (listing.standard == NFTStandard.ERC721) {
            IERC721(listing.nftContract).transferFrom(address(this), msg.sender, listing.tokenId);
        } else {
            IERC1155(listing.nftContract).safeTransferFrom(
                address(this),
                msg.sender,
                listing.tokenId,
                listing.amount,
                ""
            );
        }
        
        // Transfer payments
        IERC20(paymentToken).safeTransfer(listing.seller, sellerAmount);
        IERC20(paymentToken).safeTransfer(feeRecipient, fee);
        
        emit NFTSold(listingId, msg.sender, listing.seller, listing.amount, totalPrice, listing.standard);
    }

    /**
     * @dev Cancel listing
     */
    function cancelListing(bytes32 listingId) external whenNotPaused nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.seller == msg.sender, "Not listing owner");
        require(listing.status == ListingStatus.ACTIVE, "Listing not active");
        
        listing.status = ListingStatus.CANCELED;
        
        // Return NFT to seller
        if (listing.standard == NFTStandard.ERC721) {
            IERC721(listing.nftContract).transferFrom(address(this), msg.sender, listing.tokenId);
        } else {
            IERC1155(listing.nftContract).safeTransferFrom(
                address(this),
                msg.sender,
                listing.tokenId,
                listing.amount,
                ""
            );
        }
        
        emit ListingCanceled(listingId, msg.sender);
    }

    /**
     * @dev Create auction for ERC721 NFT
     */
    function createERC721Auction(
        address nftContract,
        uint256 tokenId,
        uint256 startPrice,
        uint256 reservePrice,
        uint256 duration
    ) external whenNotPaused onlyAuthorizedNFT(nftContract) validAuctionDuration(duration) nonReentrant {
        require(startPrice > 0, "Invalid start price");
        require(reservePrice >= startPrice, "Reserve must be >= start price");
        
        uint256 auctionId = nextAuctionId++;
        
        auctions[auctionId] = Auction({
            nftContract: nftContract,
            tokenId: tokenId,
            startPrice: startPrice,
            reservePrice: reservePrice,
            seller: msg.sender,
            highestBidder: address(0),
            highestBid: startPrice,
            endTime: block.timestamp.add(duration),
            standard: NFTStandard.ERC721,
            status: AuctionStatus.ACTIVE,
            createdAt: block.timestamp,
            minBidIncrement: minimumBidIncrement,
            reserveMet: false
        });
        
        // Transfer NFT to marketplace
        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);
        
        emit AuctionCreated(auctionId, msg.sender, nftContract, tokenId, startPrice, reservePrice, block.timestamp.add(duration));
    }

    /**
     * @dev Create auction for ERC1155 NFT
     */
    function createERC1155Auction(
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 startPrice,
        uint256 reservePrice,
        uint256 duration
    ) external whenNotPaused onlyAuthorizedNFT(nftContract) validAuctionDuration(duration) nonReentrant {
        require(startPrice > 0, "Invalid start price");
        require(amount > 0, "Invalid amount");
        require(reservePrice >= startPrice, "Reserve must be >= start price");
        
        uint256 auctionId = nextAuctionId++;
        
        auctions[auctionId] = Auction({
            nftContract: nftContract,
            tokenId: tokenId,
            startPrice: startPrice,
            reservePrice: reservePrice,
            seller: msg.sender,
            highestBidder: address(0),
            highestBid: startPrice,
            endTime: block.timestamp.add(duration),
            standard: NFTStandard.ERC1155,
            status: AuctionStatus.ACTIVE,
            createdAt: block.timestamp,
            minBidIncrement: minimumBidIncrement,
            reserveMet: false
        });
        
        // Store amount in amount field (reusing for ERC1155)
        auctions[auctionId].highestBid = startPrice;
        
        // Transfer NFT to marketplace
        IERC1155(nftContract).safeTransferFrom(msg.sender, address(this), tokenId, amount, "");
        
        emit AuctionCreated(auctionId, msg.sender, nftContract, tokenId, startPrice, reservePrice, block.timestamp.add(duration));
    }

    /**
     * @dev Place bid on auction
     */
    function placeBid(uint256 auctionId) external payable whenNotPaused nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(auction.status == AuctionStatus.ACTIVE, "Auction not active");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(msg.sender != auction.seller, "Cannot bid on own auction");
        
        uint256 minBid = auction.highestBid.add(auction.minBidIncrement);
        require(msg.value >= minBid, "Bid too low");
        
        // Refund previous highest bidder
        if (auction.highestBidder != address(0)) {
            payable(auction.highestBidder).transfer(auction.highestBid);
        }
        
        bool isNewBidder = auction.highestBidder != msg.sender;
        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;
        
        // Check if reserve is met
        if (!auction.reserveMet && msg.value >= auction.reservePrice) {
            auction.reserveMet = true;
        }
        
        emit BidPlaced(auctionId, msg.sender, msg.value, !isNewBidder);
    }

    /**
     * @dev Settle auction
     */
    function settleAuction(uint256 auctionId) external whenNotPaused nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(auction.status == AuctionStatus.ACTIVE, "Auction not active");
        require(block.timestamp >= auction.endTime, "Auction not ended");
        
        auction.status = AuctionStatus.SETTLED;
        
        if (auction.highestBidder != address(0) && auction.reserveMet) {
            // Calculate fees
            uint256 fee = auction.highestBid.mul(marketplaceFee).div(10000);
            uint256 sellerAmount = auction.highestBid.sub(fee);
            
            // Update user statistics
            userPurchasesCount[auction.highestBidder] = userPurchasesCount[auction.highestBidder].add(1);
            userSalesCount[auction.seller] = userSalesCount[auction.seller].add(1);
            userTotalVolume[auction.highestBidder] = userTotalVolume[auction.highestBidder].add(auction.highestBid);
            userTotalVolume[auction.seller] = userTotalVolume[auction.seller].add(auction.highestBid);
            totalVolume = totalVolume.add(auction.highestBid);
            totalSales = totalSales.add(1);
            protocolFees[address(0)] = protocolFees[address(0)].add(fee);
            
            // Transfer NFT to winner
            if (auction.standard == NFTStandard.ERC721) {
                IERC721(auction.nftContract).transferFrom(address(this), auction.highestBidder, auction.tokenId);
            } else {
                IERC1155(auction.nftContract).safeTransferFrom(
                    address(this),
                    auction.highestBidder,
                    auction.tokenId,
                    1, // Assuming 1 for ERC1155 auction
                    ""
                );
            }
            
            // Transfer payments
            payable(auction.seller).transfer(sellerAmount);
            payable(feeRecipient).transfer(fee);
        } else {
            // Return NFT to seller
            if (auction.standard == NFTStandard.ERC721) {
                IERC721(auction.nftContract).transferFrom(address(this), auction.seller, auction.tokenId);
            } else {
                IERC1155(auction.nftContract).safeTransferFrom(
                    address(this),
                    auction.seller,
                    auction.tokenId,
                    1,
                    ""
                );
            }
        }
        
        emit AuctionSettled(auctionId, auction.highestBidder, auction.seller, auction.highestBid, auction.reserveMet);
    }

    /**
     * @dev Make offer on NFT
     */
    function makeOffer(
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 price,
        uint256 duration,
        address paymentToken
    ) external whenNotPaused nonReentrant {
        require(price > 0, "Invalid price");
        require(amount > 0, "Invalid amount");
        
        bytes32 offerId = _getOfferId(msg.sender, nftContract, tokenId, amount, block.timestamp);
        
        offers[offerId] = Offer({
            nftContract: nftContract,
            tokenId: tokenId,
            amount: amount,
            buyer: msg.sender,
            price: price,
            paymentToken: paymentToken,
            status: OfferStatus.PENDING,
            createdAt: block.timestamp,
            expiresAt: block.timestamp.add(duration),
            seller: address(0) // Will be set when offer is accepted
        });
        
        // If paying with native token, require payment
        if (paymentToken == address(0)) {
            require(msg.value >= price, "Insufficient payment");
        } else {
            IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), price);
        }
        
        emit OfferMade(offerId, msg.sender, nftContract, tokenId, amount, price);
    }

    /**
     * @dev Accept offer
     */
    function acceptOffer(bytes32 offerId) external whenNotPaused nonReentrant {
        Offer storage offer = offers[offerId];
        require(offer.status == OfferStatus.PENDING, "Offer not pending");
        require(block.timestamp <= offer.expiresAt, "Offer expired");
        require(offer.buyer != address(0), "Invalid offer");
        
        // Check if seller owns the NFT
        if (offer.standard == NFTStandard.ERC721) {
            require(IERC721(offer.nftContract).ownerOf(offer.tokenId) == msg.sender, "Not NFT owner");
        } else {
            require(IERC1155(offer.nftContract).balanceOf(msg.sender, offer.tokenId) >= offer.amount, "Insufficient NFT balance");
        }
        
        offer.status = OfferStatus.ACCEPTED;
        offer.seller = msg.sender;
        
        // Calculate fees
        uint256 fee = offer.price.mul(marketplaceFee).div(10000);
        uint256 sellerAmount = offer.price.sub(fee);
        
        // Update user statistics
        userPurchasesCount[offer.buyer] = userPurchasesCount[offer.buyer].add(1);
        userSalesCount[msg.sender] = userSalesCount[msg.sender].add(1);
        userTotalVolume[offer.buyer] = userTotalVolume[offer.buyer].add(offer.price);
        userTotalVolume[msg.sender] = userTotalVolume[msg.sender].add(offer.price);
        totalVolume = totalVolume.add(offer.price);
        totalSales = totalSales.add(1);
        protocolFees[offer.paymentToken] = protocolFees[offer.paymentToken].add(fee);
        
        // Transfer NFT
        if (offer.standard == NFTStandard.ERC721) {
            IERC721(offer.nftContract).transferFrom(msg.sender, offer.buyer, offer.tokenId);
        } else {
            IERC1155(offer.nftContract).safeTransferFrom(
                msg.sender,
                offer.buyer,
                offer.tokenId,
                offer.amount,
                ""
            );
        }
        
        // Transfer payments
        if (offer.paymentToken == address(0)) {
            payable(msg.sender).transfer(sellerAmount);
            payable(feeRecipient).transfer(fee);
        } else {
            IERC20(offer.paymentToken).safeTransfer(msg.sender, sellerAmount);
            IERC20(offer.paymentToken).safeTransfer(feeRecipient, fee);
        }
        
        emit OfferAccepted(offerId, msg.sender, offer.buyer);
    }

    /**
     * @dev Get listing details
     */
    function getListing(bytes32 listingId) external view returns (
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 price,
        address seller,
        NFTStandard standard,
        ListingStatus status,
        uint256 createdAt,
        uint256 expiresAt
    ) {
        Listing storage listing = listings[listingId];
        return (
            listing.nftContract,
            listing.tokenId,
            listing.amount,
            listing.price,
            listing.seller,
            listing.standard,
            listing.status,
            listing.createdAt,
            listing.expiresAt
        );
    }

    /**
     * @dev Get auction details
     */
    function getAuction(uint256 auctionId) external view returns (
        address nftContract,
        uint256 tokenId,
        uint256 startPrice,
        uint256 reservePrice,
        address seller,
        address highestBidder,
        uint256 highestBid,
        uint256 endTime,
        NFTStandard standard,
        AuctionStatus status,
        uint256 createdAt,
        bool reserveMet
    ) {
        Auction storage auction = auctions[auctionId];
        return (
            auction.nftContract,
            auction.tokenId,
            auction.startPrice,
            auction.reservePrice,
            auction.seller,
            auction.highestBidder,
            auction.highestBid,
            auction.endTime,
            auction.standard,
            auction.status,
            auction.createdAt,
            auction.reserveMet
        );
    }

    /**
     * @dev Get user statistics
     */
    function getUserStats(address user) external view returns (
        uint256 listingsCount,
        uint256 salesCount,
        uint256 purchasesCount,
        uint256 totalVolume
    ) {
        return (
            userListingsCount[user],
            userSalesCount[user],
            userPurchasesCount[user],
            userTotalVolume[user]
        );
    }

    /**
     * @dev Generate listing ID
     */
    function _getListingId(address seller, address nftContract, uint256 tokenId, uint256 amount, uint256 timestamp) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(seller, nftContract, tokenId, amount, timestamp));
    }

    /**
     * @dev Generate offer ID
     */
    function _getOfferId(address buyer, address nftContract, uint256 tokenId, uint256 amount, uint256 timestamp) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(buyer, nftContract, tokenId, amount, timestamp));
    }

    /**
     * @dev Authorize NFT contract
     */
    function authorizeNFT(address nftContract) external onlyOwner {
        require(nftContract != address(0), "Invalid NFT contract");
        authorizedNFTs[nftContract] = true;
    }

    /**
     * @dev Revoke NFT authorization
     */
    function revokeNFTAuthorization(address nftContract) external onlyOwner {
        authorizedNFTs[nftContract] = false;
    }

    /**
     * @dev Update marketplace fee
     */
    function updateMarketplaceFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee too high (max 10%)");
        marketplaceFee = newFee;
    }

    /**
     * @dev Update minimum bid increment
     */
    function updateMinimumBidIncrement(uint256 newIncrement) external onlyOwner {
        minimumBidIncrement = newIncrement;
    }

    /**
     * @dev Update auction duration limits
     */
    function updateAuctionDurationLimits(uint256 newMin, uint256 newMax) external onlyOwner {
        require(newMin < newMax, "Invalid limits");
        require(newMin >= 1 hours && newMax <= 30 days, "Invalid duration");
        minimumAuctionDuration = newMin;
        maximumAuctionDuration = newMax;
    }

    /**
     * @dev Update listing duration limits
     */
    function updateListingDurationLimits(uint256 newMin, uint256 newMax) external onlyOwner {
        require(newMin < newMax, "Invalid limits");
        require(newMin >= 1 hours && newMax <= 30 days, "Invalid duration");
        minimumListingDuration = newMin;
        maximumListingDuration = newMax;
    }

    /**
     * @dev Update fee recipient
     */
    function updateFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient");
        feeRecipient = newRecipient;
    }

    /**
     * @dev Withdraw protocol fees
     */
    function withdrawFees(address token, uint256 amount) external {
        require(msg.sender == feeRecipient || msg.sender == owner(), "Not authorized");
        require(protocolFees[token] >= amount, "Insufficient fees");
        
        protocolFees[token] = protocolFees[token].sub(amount);
        
        if (token == address(0)) {
            payable(feeRecipient).transfer(amount);
        } else {
            IERC20(token).safeTransfer(feeRecipient, amount);
        }
    }

    /**
     * @dev Emergency pause
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency token recovery
     */
    function recoverStuckTokens(address token, uint256 amount) external onlyOwner {
        require(block.timestamp > 1735689600, "Emergency recovery locked");
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @dev View function to check marketplace statistics
     */
    function getMarketplaceStats() external view returns (
        uint256 _totalVolume,
        uint256 _totalSales,
        uint256 _marketplaceFee
    ) {
        return (totalVolume, totalSales, marketplaceFee);
    }
}
