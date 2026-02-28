// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";


/**
 * @title MetaTransactionPaymaster
 * @dev Gasless transaction paymaster for SylOS ecosystem
 * Features:
 * - Sponsor transactions for users
 * - ERC20 token-based payment system
 * - Rate limiting and quotas
 * - Whitelist/Blacklist management
 * - Analytics and monitoring
 * - Emergency controls
 */
contract MetaTransactionPaymaster is EIP712, AccessControl, ReentrancyGuard {
    using ECDSA for bytes32;
    

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // EIP712 type hashes
    bytes32 public constant META_TRANSACTION_TYPEHASH = keccak256(
        "MetaTransaction(uint256 nonce,uint256 from,uint256 chainId,address to,bytes data,uint256 gasLimit,uint256 gasPrice,address paymentToken,uint256 paymentAmount)"
    );

    // Structs
    struct MetaTransaction {
        uint256 nonce;
        address from;
        uint256 chainId;
        address to;
        bytes data;
        uint256 gasLimit;
        uint256 gasPrice;
        address paymentToken;
        uint256 paymentAmount;
    }

    struct UserInfo {
        uint256 nonce;
        uint256 lastTransaction;
        uint256 transactionCount;
        uint256 totalPaid;
        uint256 monthlyQuota;
        uint256 usedQuota;
        bool isWhitelisted;
        bool isBlacklisted;
        uint256 rateLimitTimestamp;
        uint256 rateLimitCount;
    }

    struct PaymentToken {
        address token;
        uint256 gasPrice; // gas price in wei for this token
        bool isActive;
        uint256 decimals;
        string name;
        string symbol;
    }

    struct RateLimit {
        uint256 maxTransactionsPerDay;
        uint256 maxGasPerDay;
        uint256 cooldownPeriod;
    }

    // Storage
    mapping(address => UserInfo) public userInfo;
    mapping(address => PaymentToken) public paymentTokens;
    address[] public tokenList;
    mapping(bytes32 => bool) public executedTransactions;
    
    RateLimit public rateLimits;
    uint256 public defaultGasPrice = 20000000000; // 20 gwei
    uint256 public feePercentage = 200; // 2% in basis points
    address public treasury;
    bool public isPaused = false;
    uint256 public minPaymentAmount = 1000; // Minimum payment in wei equivalent
    uint256 public maxPaymentAmount = 1000000000000000000000; // Maximum payment (1 ETH worth)

    // Analytics
    uint256 public totalSponsoredTransactions = 0;
    uint256 public totalGasSponsored = 0;
    uint256 public totalFeesCollected = 0;
    mapping(address => uint256) public tokenFeesCollected;

    // Events
    event MetaTransactionExecuted(
        address indexed from,
        address indexed to,
        bytes32 txHash,
        uint256 gasUsed,
        address paymentToken,
        uint256 paymentAmount
    );
    event UserWhitelisted(address indexed user, bool status);
    event UserBlacklisted(address indexed user, bool status);
    event PaymentTokenAdded(address indexed token, uint256 gasPrice, string name, string symbol);
    event PaymentTokenUpdated(address indexed token, uint256 gasPrice, bool isActive);
    event RateLimitsUpdated(uint256 maxTransactionsPerDay, uint256 maxGasPerDay, uint256 cooldownPeriod);
    event SettingsUpdated(uint256 defaultGasPrice, uint256 feePercentage, uint256 minPaymentAmount, uint256 maxPaymentAmount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    constructor(address admin, address treasury_) EIP712("MetaTransactionPaymaster", "1.0.0") {
        require(admin != address(0), "Invalid admin");
        require(treasury_ != address(0), "Invalid treasury");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);

        treasury = treasury_;

        // Set default rate limits
        rateLimits = RateLimit({
            maxTransactionsPerDay: 100,
            maxGasPerDay: 5000000, // 5M gas per day
            cooldownPeriod: 10 seconds
        });
    }

    /**
     * @dev Execute a meta transaction
     * @param user User address
     * @param signature User signature
     * @param metaTx Meta transaction data
     */
    function executeMetaTransaction(
        address user,
        bytes calldata signature,
        MetaTransaction calldata metaTx
    ) external nonReentrant returns (bytes memory result) {
        require(!isPaused, "Paymaster is paused");
        require(user != address(0), "Invalid user");
        require(metaTx.from == user, "Invalid user in meta transaction");
        require(metaTx.chainId == block.chainid, "Invalid chain ID");
        require(metaTx.to != address(0), "Invalid target contract");
        require(metaTx.gasLimit > 0, "Invalid gas limit");
        require(metaTx.gasPrice > 0, "Invalid gas price");
        require(metaTx.paymentAmount >= minPaymentAmount, "Payment too small");
        require(metaTx.paymentAmount <= maxPaymentAmount, "Payment too large");

        // Check if user is blacklisted
        UserInfo storage userData = userInfo[user];
        require(!userData.isBlacklisted, "User is blacklisted");

        // Check rate limits
        _checkRateLimits(user);

        // Verify signature
        bytes32 txHash = _getTxHash(metaTx);
        require(!executedTransactions[txHash], "Transaction already executed");
        require(_verifySignature(metaTx, signature), "Invalid signature");

        // Check and update user nonce
        require(metaTx.nonce == userData.nonce, "Invalid nonce");
        userData.nonce = userData.nonce + 1;

        // Mark transaction as executed
        executedTransactions[txHash] = true;

        // Update rate limiting
        _updateRateLimits(user, metaTx.gasLimit);

        // Execute the meta transaction
        (bool success, bytes memory data) = metaTx.to.call{gas: metaTx.gasLimit}(
            abi.encodePacked(metaTx.data, metaTx.from)
        );

        require(success, "Meta transaction failed");

        // Handle payment
        uint256 payment = _handlePayment(user, metaTx.paymentToken, metaTx.gasPrice, metaTx.gasLimit, metaTx.paymentAmount);

        // Update analytics
        totalSponsoredTransactions += 1;
        totalGasSponsored += metaTx.gasLimit;
        userData.totalPaid += payment;
        userData.lastTransaction = block.timestamp;

        emit MetaTransactionExecuted(user, metaTx.to, txHash, metaTx.gasLimit, metaTx.paymentToken, payment);

        return data;
    }

    /**
     * @dev Handle payment processing
     * @param user User address
     * @param token Payment token
     * @param paymentAmount Payment amount
     */
    function _handlePayment(
        address user,
        address token,
        uint256 /* gasPrice */,
        uint256 /* gasLimit */,
        uint256 paymentAmount
    ) internal returns (uint256 payment) {
        if (token == address(0)) {
            // Native token payment
            require(msg.value >= paymentAmount, "Insufficient payment");
            payment = paymentAmount;
            if (msg.value > paymentAmount) {
                (bool returnSuccess, ) = payable(user).call{value: msg.value - paymentAmount}("");
                require(returnSuccess, "Refund failed");
            }
        } else {
            // ERC20 token payment
            require(paymentTokens[token].isActive, "Payment token not supported");
            payment = paymentAmount;
            require(IERC20(token).transferFrom(user, treasury, payment), "Token transfer failed");
        }

        // Collect fee
        uint256 fee = (payment * feePercentage) / 10000;
        totalFeesCollected = totalFeesCollected + fee;
        tokenFeesCollected[token] = tokenFeesCollected[token] + fee;

        return payment;
    }

    /**
     * @dev Check rate limits for a user
     * @param user User address
     */
    function _checkRateLimits(address user) internal view {
        UserInfo memory userData = userInfo[user];
        
        // Check daily transaction limit
        if (block.timestamp < userData.rateLimitTimestamp + 1 days) {
            require(userData.rateLimitCount < rateLimits.maxTransactionsPerDay, "Daily transaction limit exceeded");
        } else {
            // Reset daily counter
            require(userInfo[user].usedQuota < userInfo[user].monthlyQuota, "Monthly quota exceeded");
        }

        // Check cooldown period
        require(block.timestamp >= userData.lastTransaction + rateLimits.cooldownPeriod, "Cooldown period active");
    }

    /**
     * @dev Update rate limits for a user
     * @param user User address
     * @param gasUsed Gas used in transaction
     */
    function _updateRateLimits(address user, uint256 gasUsed) internal {
        UserInfo storage userData = userInfo[user];

        if (block.timestamp >= userData.rateLimitTimestamp + 1 days) {
            // Reset daily counters
            userData.rateLimitTimestamp = block.timestamp;
            userData.rateLimitCount = 0;
        }

        userData.rateLimitCount = userData.rateLimitCount + 1;
        userData.usedQuota = userData.usedQuota + gasUsed;
        userData.transactionCount = userData.transactionCount + 1;
    }

    /**
     * @dev Get transaction hash for signature verification
     * @param metaTx Meta transaction data
     */
    function _getTxHash(MetaTransaction calldata metaTx) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            META_TRANSACTION_TYPEHASH,
            metaTx.nonce,
            metaTx.from,
            metaTx.chainId,
            metaTx.to,
            keccak256(metaTx.data),
            metaTx.gasLimit,
            metaTx.gasPrice,
            metaTx.paymentToken,
            metaTx.paymentAmount
        )));
    }

    /**
     * @dev Verify signature
     * @param metaTx Meta transaction data
     * @param signature Signature
     */
    function _verifySignature(MetaTransaction calldata metaTx, bytes calldata signature) internal view returns (bool) {
        bytes32 txHash = _getTxHash(metaTx);
        address signer = txHash.recover(signature);
        return signer == metaTx.from;
    }

    /**
     * @dev Add payment token
     * @param token Token address
     * @param gasPrice Gas price for this token
     * @param name Token name
     * @param symbol Token symbol
     */
    function addPaymentToken(
        address token,
        uint256 gasPrice,
        string calldata name,
        string calldata symbol
    ) external onlyRole(MANAGER_ROLE) {
        require(token != address(0), "Invalid token address");
        require(gasPrice > 0, "Invalid gas price");

        PaymentToken memory paymentToken = PaymentToken({
            token: token,
            gasPrice: gasPrice,
            isActive: true,
            decimals: IERC20Metadata(token).decimals(),
            name: name,
            symbol: symbol
        });

        paymentTokens[token] = paymentToken;
        tokenList.push(token);

        emit PaymentTokenAdded(token, gasPrice, name, symbol);
    }

    /**
     * @dev Update payment token
     * @param token Token address
     * @param gasPrice New gas price
     * @param isActive Active status
     */
    function updatePaymentToken(
        address token,
        uint256 gasPrice,
        bool isActive
    ) external onlyRole(MANAGER_ROLE) {
        require(paymentTokens[token].token != address(0), "Token not found");
        
        paymentTokens[token].gasPrice = gasPrice;
        paymentTokens[token].isActive = isActive;

        emit PaymentTokenUpdated(token, gasPrice, isActive);
    }

    /**
     * @dev Set user whitelist status
     * @param user User address
     * @param isWhitelisted Whitelist status
     * @param monthlyQuota Monthly quota
     */
    function setWhitelist(
        address user,
        bool isWhitelisted,
        uint256 monthlyQuota
    ) external onlyRole(MANAGER_ROLE) {
        require(user != address(0), "Invalid user address");
        
        userInfo[user].isWhitelisted = isWhitelisted;
        if (monthlyQuota > 0) {
            userInfo[user].monthlyQuota = monthlyQuota;
        }

        emit UserWhitelisted(user, isWhitelisted);
    }

    /**
     * @dev Set user blacklist status
     * @param user User address
     * @param isBlacklisted Blacklist status
     */
    function setBlacklist(address user, bool isBlacklisted) external onlyRole(MANAGER_ROLE) {
        require(user != address(0), "Invalid user address");
        
        userInfo[user].isBlacklisted = isBlacklisted;
        userInfo[user].monthlyQuota = 0; // Reset quota for blacklisted users

        emit UserBlacklisted(user, isBlacklisted);
    }

    /**
     * @dev Update rate limits
     * @param maxTransactionsPerDay Max transactions per day
     * @param maxGasPerDay Max gas per day
     * @param cooldownPeriod Cooldown period
     */
    function updateRateLimits(
        uint256 maxTransactionsPerDay,
        uint256 maxGasPerDay,
        uint256 cooldownPeriod
    ) external onlyRole(MANAGER_ROLE) {
        require(maxTransactionsPerDay > 0 && maxTransactionsPerDay <= 1000, "Invalid max transactions");
        require(cooldownPeriod <= 1 hours, "Invalid cooldown period");

        rateLimits = RateLimit({
            maxTransactionsPerDay: maxTransactionsPerDay,
            maxGasPerDay: maxGasPerDay,
            cooldownPeriod: cooldownPeriod
        });

        emit RateLimitsUpdated(maxTransactionsPerDay, maxGasPerDay, cooldownPeriod);
    }

    /**
     * @dev Update contract settings
     * @param newDefaultGasPrice New default gas price
     * @param newFeePercentage New fee percentage
     * @param newMinPayment New minimum payment
     * @param newMaxPayment New maximum payment
     */
    function updateSettings(
        uint256 newDefaultGasPrice,
        uint256 newFeePercentage,
        uint256 newMinPayment,
        uint256 newMaxPayment
    ) external onlyRole(MANAGER_ROLE) {
        require(newFeePercentage <= 1000, "Fee too high"); // Max 10%
        require(newMinPayment <= newMaxPayment, "Invalid payment range");

        defaultGasPrice = newDefaultGasPrice;
        feePercentage = newFeePercentage;
        minPaymentAmount = newMinPayment;
        maxPaymentAmount = newMaxPayment;

        emit SettingsUpdated(newDefaultGasPrice, newFeePercentage, newMinPayment, newMaxPayment);
    }

    /**
     * @dev Update treasury address
     * @param newTreasury New treasury address
     */
    function updateTreasury(address newTreasury) external onlyRole(MANAGER_ROLE) {
        require(newTreasury != address(0), "Invalid treasury address");
        
        address oldTreasury = treasury;
        treasury = newTreasury;

        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @dev Pause/unpause contract
     * @param _pauseStatus Pause status
     */
    function setPaused(bool _pauseStatus) external onlyRole(PAUSER_ROLE) {
        isPaused = _pauseStatus;
    }

    /**
     * @dev Get user info
     * @param user User address
     */
    function getUserInfo(address user) external view returns (UserInfo memory) {
        return userInfo[user];
    }

    /**
     * @dev Get payment token info
     * @param token Token address
     */
    function getPaymentToken(address token) external view returns (PaymentToken memory) {
        return paymentTokens[token];
    }

    /**
     * @dev Get all supported tokens
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return tokenList;
    }

    /**
     * @dev Emergency function to recover tokens
     * @param tokenAddress Token address
     * @param amount Amount to recover
     */
    function recoverTokens(address tokenAddress, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(tokenAddress).transfer(treasury, amount);
    }

    /**
     * @dev Emergency function to recover ETH
     */
    function recoverETH() external onlyRole(DEFAULT_ADMIN_ROLE) {
        payable(treasury).transfer(address(this).balance);
    }

    /**
     * @dev Receive function
     */
    receive() external payable {}

    /**
     * @dev Emergency pause function
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        isPaused = true;
    }

    /**
     * @dev Unpause function
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        isPaused = false;
    }
}
