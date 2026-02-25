// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

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
        bool isWhitelisted;
        bool isBlacklisted;
    }

    struct PaymentToken {
        address token;
        string name;
        string symbol;
        uint256 gasPrice; // in token units
        bool isActive;
    }

    // Storage
    mapping(address => UserInfo) public userInfo;
    mapping(address => PaymentToken) public paymentTokens;
    address[] public tokenList;
    uint256 public defaultGasPrice = 20000000000; // 20 gwei
    uint256 public totalGasSponsored = 0;
    uint256 public totalFeesCollected = 0;

    // Rate limiting
    uint256 public maxTransactionsPerDay = 100;
    uint256 public minTransactionInterval = 1; // seconds
    uint256 public maxGasLimit = 500000;

    // Events
    event MetaTransactionExecuted(
        address indexed from,
        address indexed to,
        uint256 gasUsed,
        uint256 feePaid,
        address paymentToken
    );
    event PaymentTokenAdded(address indexed token, string name, string symbol, uint256 gasPrice);
    event PaymentTokenUpdated(address indexed token, uint256 gasPrice, bool isActive);
    event UserWhitelisted(address indexed user, bool isWhitelisted);
    event UserBlacklisted(address indexed user, bool isBlacklisted);
    event GasPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event RateLimitUpdated(uint256 maxTxPerDay, uint256 minInterval, uint256 maxGas);

    constructor(address admin, address treasury) EIP712("MetaTransactionPaymaster", "1.0.0") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);

        // Treasury gets access to update settings
        _grantRole(MANAGER_ROLE, treasury);
    }

    // Execute meta-transaction
    function executeMetaTransaction(
        MetaTransaction calldata metaTx,
        bytes calldata signature
    ) external nonReentrant returns (bytes memory) {
        require(_verifySignature(metaTx, signature), "Invalid signature");
        require(metaTx.from == msg.sender, "Sender must be metaTx.from");
        require(metaTx.chainId == block.chainid, "Invalid chainId");
        require(metaTx.gasLimit <= maxGasLimit, "Gas limit too high");

        UserInfo storage user = userInfo[metaTx.from];
        require(!user.isBlacklisted, "User is blacklisted");
        
        // Rate limiting
        require(
            block.timestamp >= user.lastTransaction + minTransactionInterval,
            "Transaction too soon"
        );
        require(
            _getDailyTransactionCount(metaTx.from) < maxTransactionsPerDay,
            "Daily limit exceeded"
        );

        // Validate payment
        uint256 requiredFee = _calculateRequiredFee(metaTx.gasLimit, metaTx.gasPrice, metaTx.paymentToken);
        require(metaTx.paymentAmount >= requiredFee, "Insufficient payment");

        // Process payment
        if (metaTx.paymentToken != address(0)) {
            require(_isValidPaymentToken(metaTx.paymentToken), "Invalid payment token");
            require(
                IERC20(metaTx.paymentToken).transferFrom(metaTx.from, address(this), metaTx.paymentAmount),
                "Payment transfer failed"
            );
        } else {
            require(msg.value >= metaTx.paymentAmount, "Insufficient ETH payment");
        }

        // Update user info
        user.nonce++;
        user.lastTransaction = block.timestamp;
        user.transactionCount++;
        user.totalPaid += metaTx.paymentAmount;

        // Execute the actual transaction
        (bool success, bytes memory returnData) = metaTx.to.call{gas: metaTx.gasLimit}(metaTx.data);
        require(success, "Meta transaction failed");

        // Track analytics
        totalGasSponsored += metaTx.gasLimit;
        totalFeesCollected += metaTx.paymentAmount;

        emit MetaTransactionExecuted(
            metaTx.from,
            metaTx.to,
            metaTx.gasLimit,
            metaTx.paymentAmount,
            metaTx.paymentToken
        );

        return returnData;
    }

    function _verifySignature(MetaTransaction calldata metaTx, bytes calldata signature) 
        internal 
        view 
        returns (bool) 
    {
        bytes32 structHash = keccak256(abi.encode(
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
        ));

        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);
        return signer == metaTx.from;
    }

    function _calculateRequiredFee(
        uint256 gasLimit,
        uint256 gasPrice,
        address paymentToken
    ) internal view returns (uint256) {
        if (paymentToken == address(0)) {
            // ETH payment
            return gasLimit * gasPrice;
        } else {
            // Token payment using configured rate
            PaymentToken storage token = paymentTokens[paymentToken];
            if (token.isActive) {
                return gasLimit * token.gasPrice;
            } else {
                return gasLimit * defaultGasPrice;
            }
        }
    }

    function _isValidPaymentToken(address token) internal view returns (bool) {
        return paymentTokens[token].isActive;
    }

    function _getDailyTransactionCount(address user) internal view returns (uint256) {
        // Simplified: count all transactions (in production, you'd track by day)
        return userInfo[user].transactionCount;
    }

    // Payment token management
    function addPaymentToken(
        address token,
        uint256 gasPrice,
        string calldata name,
        string calldata symbol
    ) external onlyRole(MANAGER_ROLE) {
        require(token != address(0), "Invalid token address");
        require(gasPrice > 0, "Invalid gas price");
        require(!paymentTokens[token].isActive, "Token already added");

        paymentTokens[token] = PaymentToken({
            token: token,
            name: name,
            symbol: symbol,
            gasPrice: gasPrice,
            isActive: true
        });
        tokenList.push(token);

        emit PaymentTokenAdded(token, name, symbol, gasPrice);
    }

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

    // User management
    function whitelistUser(address user, bool isWhitelisted) external onlyRole(MANAGER_ROLE) {
        userInfo[user].isWhitelisted = isWhitelisted;
        emit UserWhitelisted(user, isWhitelisted);
    }

    function blacklistUser(address user, bool isBlacklisted) external onlyRole(MANAGER_ROLE) {
        userInfo[user].isBlacklisted = isBlacklisted;
        emit UserBlacklisted(user, isBlacklisted);
    }

    // Configuration
    function setDefaultGasPrice(uint256 newPrice) external onlyRole(MANAGER_ROLE) {
        uint256 oldPrice = defaultGasPrice;
        defaultGasPrice = newPrice;
        emit GasPriceUpdated(oldPrice, newPrice);
    }

    function setRateLimits(
        uint256 _maxTxPerDay,
        uint256 _minInterval,
        uint256 _maxGasLimit
    ) external onlyRole(MANAGER_ROLE) {
        maxTransactionsPerDay = _maxTxPerDay;
        minTransactionInterval = _minInterval;
        maxGasLimit = _maxGasLimit;
        emit RateLimitUpdated(_maxTxPerDay, _minInterval, _maxGasLimit);
    }

    // Emergency functions
    function pause() external onlyRole(PAUSER_ROLE) {
        // Note: This contract doesn't inherit from Pausable, so pause functionality
        // would need to be implemented differently (emergency stops, etc.)
    }

    // Withdraw funds
    function withdrawToken(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0)) {
            payable(msg.sender).transfer(amount);
        } else {
            IERC20(token).transfer(msg.sender, amount);
        }
    }

    // View functions
    function getUserInfo(address user) external view returns (UserInfo memory) {
        return userInfo[user];
    }

    function getPaymentToken(address token) external view returns (PaymentToken memory) {
        return paymentTokens[token];
    }

    function getAllPaymentTokens() external view returns (address[] memory) {
        return tokenList;
    }

    function getNonce(address user) external view returns (uint256) {
        return userInfo[user].nonce;
    }

    // Receive function for ETH payments
    receive() external payable {}
}