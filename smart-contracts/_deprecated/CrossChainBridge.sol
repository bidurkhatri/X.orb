// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


/**
 * @title CrossChainBridge
 * @dev Advanced cross-chain bridge with multi-network support
 * Supports token bridging between Ethereum mainnet, Polygon, Arbitrum, Optimism, and BSC
 */
contract CrossChainBridge is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    

    // Events
    event TokensBridged(
        bytes32 indexed bridgeId,
        address indexed token,
        uint256 amount,
        uint256 fromChainId,
        uint256 toChainId,
        address indexed toAddress,
        uint256 timestamp
    );

    event CrossChainMessageProcessed(
        bytes32 indexed messageId,
        uint256 fromChainId,
        uint256 toChainId,
        address indexed fromAddress,
        address indexed toAddress
    );

    event ChainSupported(uint256 indexed chainId, bool supported);
    event TokenWhitelisted(address indexed token, bool whitelisted);

    // Structs
    struct BridgeRequest {
        address token;
        uint256 amount;
        uint256 fromChainId;
        uint256 toChainId;
        address toAddress;
        bytes data;
        uint256 timestamp;
        bool processed;
    }

    struct CrossChainMessage {
        uint256 fromChainId;
        uint256 toChainId;
        address fromAddress;
        address toAddress;
        bytes data;
        uint256 timestamp;
        bool processed;
    }

    // State variables
    mapping(bytes32 => BridgeRequest) public bridgeRequests;
    mapping(uint256 => bool) public supportedChains;
    mapping(address => bool) public tokenWhitelist;
    mapping(address => uint256) public userBridgeCount;
    mapping(bytes32 => bool) public processedMessages;
    
    uint256 public constant MAX_BRIDGE_AMOUNT = 1000000 ether; // Maximum bridge amount
    uint256 public constant MIN_BRIDGE_AMOUNT = 0.01 ether; // Minimum bridge amount
    uint256 public bridgeFee = 1; // 0.01% fee
    uint256 public totalVolumeBridged;
    uint256 public totalBridgesProcessed;

    // Modifiers
    modifier onlySupportedChain(uint256 chainId) {
        require(supportedChains[chainId], "Chain not supported");
        _;
    }

    modifier validAmount(uint256 amount) {
        require(amount >= MIN_BRIDGE_AMOUNT && amount <= MAX_BRIDGE_AMOUNT, "Invalid amount");
        _;
    }

    modifier validChainId(uint256 chainId) {
        require(chainId > 0 && chainId != block.chainid, "Invalid chain ID");
        _;
    }

    constructor() {
        // Support mainnet chains by default
        supportedChains[1] = true; // Ethereum Mainnet
        supportedChains[137] = true; // Polygon
        supportedChains[42161] = true; // Arbitrum
        supportedChains[10] = true; // Optimism
        supportedChains[56] = true; // BSC
        
        // Whitelist some common tokens
        tokenWhitelist[0xA0b86a33E6411b8b7ce9c3a8b6C0C3C5a7F9d8c2] = true; // Example token
    }

    /**
     * @dev Bridge tokens to another chain
     * @param amount Amount of tokens to bridge
     * @param toChainId Target chain ID
     * @param toAddress Recipient address on target chain
     * @param data Additional data for the bridge
     */
    function bridgeTokens(
        uint256 amount,
        uint256 toChainId,
        address toAddress,
        bytes calldata data
    ) external payable validAmount(amount) validChainId(toChainId) nonReentrant {
        require(toAddress != address(0), "Invalid recipient address");
        
        uint256 bridgeFeeAmount = amount.mul(bridgeFee).div(10000);
        uint256 actualAmount = amount.sub(bridgeFeeAmount);
        
        bytes32 bridgeId = keccak256(
            abi.encodePacked(
                msg.sender,
                actualAmount,
                toChainId,
                toAddress,
                data,
                block.timestamp,
                block.chainid
            )
        );
        
        // Store bridge request
        bridgeRequests[bridgeId] = BridgeRequest({
            token: address(0), // Native token
            amount: actualAmount,
            fromChainId: block.chainid,
            toChainId: toChainId,
            toAddress: toAddress,
            data: data,
            timestamp: block.timestamp,
            processed: false
        });
        
        // Update statistics
        userBridgeCount[msg.sender] = userBridgeCount[msg.sender].add(1);
        totalVolumeBridged = totalVolumeBridged.add(actualAmount);
        totalBridgesProcessed = totalBridgesProcessed.add(1);
        
        // Emit event for bridge processing
        emit TokensBridged(
            bridgeId,
            address(0),
            actualAmount,
            block.chainid,
            toChainId,
            toAddress,
            block.timestamp
        );
    }

    /**
     * @dev Bridge ERC20 tokens
     */
    function bridgeERC20Tokens(
        address token,
        uint256 amount,
        uint256 toChainId,
        address toAddress,
        bytes calldata data
    ) external validAmount(amount) validChainId(toChainId) nonReentrant {
        require(tokenWhitelist[token], "Token not whitelisted");
        require(toAddress != address(0), "Invalid recipient address");
        
        uint256 bridgeFeeAmount = amount.mul(bridgeFee).div(10000);
        uint256 actualAmount = amount.sub(bridgeFeeAmount);
        
        // Transfer tokens from user
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        bytes32 bridgeId = keccak256(
            abi.encodePacked(
                msg.sender,
                token,
                actualAmount,
                toChainId,
                toAddress,
                data,
                block.timestamp
            )
        );
        
        // Store bridge request
        bridgeRequests[bridgeId] = BridgeRequest({
            token: token,
            amount: actualAmount,
            fromChainId: block.chainid,
            toChainId: toChainId,
            toAddress: toAddress,
            data: data,
            timestamp: block.timestamp,
            processed: false
        });
        
        // Update statistics
        userBridgeCount[msg.sender] = userBridgeCount[msg.sender].add(1);
        totalVolumeBridged = totalVolumeBridged.add(actualAmount);
        totalBridgesProcessed = totalBridgesProcessed.add(1);
        
        // Emit event
        emit TokensBridged(
            bridgeId,
            token,
            actualAmount,
            block.chainid,
            toChainId,
            toAddress,
            block.timestamp
        );
    }

    /**
     * @dev Process cross-chain message (to be called by bridge oracles)
     */
    function processCrossChainMessage(
        bytes32 messageId,
        uint256 fromChainId,
        uint256 toChainId,
        address fromAddress,
        address toAddress,
        bytes calldata data
    ) external onlyOwner {
        require(!processedMessages[messageId], "Message already processed");
        require(fromChainId == block.chainid || toChainId == block.chainid, "Invalid chain");
        
        processedMessages[messageId] = true;
        
        // Process the message (simplified - in production, this would include more complex logic)
        if (toChainId == block.chainid) {
            // Message is for this chain
            // Execute the requested action
        }
        
        emit CrossChainMessageProcessed(
            messageId,
            fromChainId,
            toChainId,
            fromAddress,
            toAddress
        );
    }

    /**
     * @dev Get bridge request details
     */
    function getBridgeRequest(bytes32 bridgeId) external view returns (
        address token,
        uint256 amount,
        uint256 fromChainId,
        uint256 toChainId,
        address toAddress,
        uint256 timestamp,
        bool processed
    ) {
        BridgeRequest storage request = bridgeRequests[bridgeId];
        return (
            request.token,
            request.amount,
            request.fromChainId,
            request.toChainId,
            request.toAddress,
            request.timestamp,
            request.processed
        );
    }

    /**
     * @dev Get user bridge statistics
     */
    function getUserBridgeStats(address user) external view returns (
        uint256 bridgeCount,
        uint256 totalVolume,
        uint256 lastBridgeTime
    ) {
        return (
            userBridgeCount[user],
            0, // Would need additional tracking for total volume per user
            0  // Would need additional tracking for last bridge time
        );
    }

    /**
     * @dev Register a new supported chain
     */
    function registerChain(uint256 chainId) external onlyOwner {
        require(chainId != block.chainid, "Cannot register current chain");
        supportedChains[chainId] = true;
        emit ChainSupported(chainId, true);
    }

    /**
     * @dev Unregister a supported chain
     */
    function unregisterChain(uint256 chainId) external onlyOwner {
        supportedChains[chainId] = false;
        emit ChainSupported(chainId, false);
    }

    /**
     * @dev Whitelist a token
     */
    function whitelistToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token address");
        tokenWhitelist[token] = true;
        emit TokenWhitelisted(token, true);
    }

    /**
     * @dev Remove token from whitelist
     */
    function removeTokenFromWhitelist(address token) external onlyOwner {
        tokenWhitelist[token] = false;
        emit TokenWhitelisted(token, false);
    }

    /**
     * @dev Update bridge fee
     */
    function updateBridgeFee(uint256 newFee) external onlyOwner {
        require(newFee <= 100, "Fee too high (max 1%)");
        bridgeFee = newFee;
    }

    /**
     * @dev Withdraw accumulated fees
     */
    function withdrawFees(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }

    /**
     * @dev Get contract balance
     */
    function getContractBalance(address token) external view returns (uint256) {
        if (token == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(token).balanceOf(address(this));
        }
    }

    /**
     * @dev Emergency function to recover stuck tokens
     */
    function recoverStuckTokens(address token, uint256 amount) external onlyOwner {
        require(block.timestamp > 1735689600, "Emergency recovery locked until 2025-01-01");
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @dev View function to check if a token is whitelisted
     */
    function isTokenWhitelisted(address token) external view returns (bool) {
        return tokenWhitelist[token];
    }

    /**
     * @dev View function to check if a chain is supported
     */
    function isChainSupported(uint256 chainId) external view returns (bool) {
        return supportedChains[chainId];
    }

    /**
     * @dev View function to get total volume bridged
     */
    function getTotalVolumeBridged() external view returns (uint256) {
        return totalVolumeBridged;
    }

    /**
     * @dev View function to get total bridges processed
     */
    function getTotalBridgesProcessed() external view returns (uint256) {
        return totalBridgesProcessed;
    }

    // Fallback function to receive ETH
    receive() external payable {}
}
