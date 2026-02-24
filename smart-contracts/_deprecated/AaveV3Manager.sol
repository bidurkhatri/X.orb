// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


interface IPool {
    struct Configuration {
        uint256 data;
    }
    
    struct ReserveData {
        //stores the reserve configuration
        Configuration configuration;
        //the liquidity index. Expressed in ray
        uint128 liquidityIndex;
        //the current supply rate. Expressed in ray
        uint128 currentLiquidityRate;
        //variable borrow index. Expressed in ray
        uint128 variableBorrowIndex;
        //the current variable borrow rate. Expressed in ray
        uint128 currentVariableBorrowRate;
        //the current stable borrow rate. Expressed in ray
        uint128 currentStableBorrowRate;
        //timestamp of the last update
        uint40 lastUpdateTimestamp;
        //the id of the reserve. Represents the position in the list of the active reserves
        uint16 id;
        //aToken address
        address aTokenAddress;
        //stableDebtToken address
        address stableDebtTokenAddress;
        //variableDebtToken address
        address variableDebtTokenAddress;
        //address of the interest rate strategy
        address interestRateStrategyAddress;
        //the current treasury balance, scaled
        uint128 accruedToTreasury;
        //the outstanding unbacked aTokens minted through the bridging top
        uint128 unbacked;
        //the outstanding debt borrowed against this asset in the other protocol, merged here
        uint128 isolationModeTotalDebt;
    }
    
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;
    
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);
    
    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external;
    
    function repay(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        address onBehalfOf
    ) external returns (uint256);
    
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );
    
    function getReserveData(address asset) external view returns (ReserveData memory);
}

interface IPriceOracleGetter {
    function getAssetPrice(address asset) external view returns (uint256);
}

interface IAToken {
    function balanceOf(address user) external view returns (uint256);
    function scaledBalanceOf(address user) external view returns (uint256);
    function principalBalanceOf(address user) external view returns (uint256);
    function scaledTotalSupply() external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

interface IVariableDebtToken {
    function balanceOf(address user) external view returns (uint256);
    function scaledBalanceOf(address user) external view returns (uint256);
    function scaledTotalSupply() external view returns (uint256);
}

interface IStableDebtToken {
    function balanceOf(address user) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

/**
 * @title AaveV3Manager
 * @dev Advanced Aave V3 integration for lending and borrowing operations
 */
contract AaveV3Manager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    

    // Events
    event Supplied(
        address indexed user,
        address indexed asset,
        uint256 amount,
        uint256 aTokenAmount
    );

    event Withdrawn(
        address indexed user,
        address indexed asset,
        uint256 amount,
        uint256 aTokenAmount
    );

    event Borrowed(
        address indexed user,
        address indexed asset,
        uint256 amount,
        uint256 debtTokenAmount,
        uint256 interestRateMode
    );

    event Repaid(
        address indexed user,
        address indexed asset,
        uint256 amount,
        uint256 debtTokenAmount
    );

    event LiquidationCall(
        address indexed collateralAsset,
        address indexed debtAsset,
        address indexed user,
        uint256 debtToCover,
        bool receiveAToken
    );

    // State variables
    IPool public immutable pool;
    IPriceOracleGetter public immutable oracle;
    mapping(address => bool) public supportedAssets;
    mapping(address => UserPosition) public userPositions;
    mapping(address => AssetConfig) public assetConfigs;
    mapping(address => bool) public authorizedUsers;
    
    uint256 public constant MAX_LTV = 8000; // 80% max LTV
    uint256 public constant LIQUIDATION_THRESHOLD = 8500; // 85% liquidation threshold
    uint256 public constant LIQUIDATION_BONUS = 500; // 5% liquidation bonus
    uint256 public constant HEALTH_FACTOR_LIQUIDATION_THRESHOLD = 1e18; // 1.0 HF for liquidation
    
    struct UserPosition {
        uint256 totalCollateral;
        uint256 totalDebt;
        uint256 availableBorrows;
        uint256 currentLTV;
        uint256 healthFactor;
        bool isLiquidatable;
        uint256 lastUpdateTime;
    }
    
    struct AssetConfig {
        bool isEnabled;
        bool canBeCollateral;
        bool canBeBorrowed;
        uint256 maxLTV;
        uint256 liquidationThreshold;
        uint256 liquidationBonus;
    }
    
    // Modifiers
    modifier onlySupportedAsset(address asset) {
        require(supportedAssets[asset], "Asset not supported");
        _;
    }

    modifier onlyAuthorizedUser() {
        require(authorizedUsers[msg.sender] || msg.sender == owner(), "User not authorized");
        _;
    }

    constructor(address _pool, address _oracle) {
        pool = IPool(_pool);
        oracle = IPriceOracleGetter(_oracle);
        
        // Initialize with some default supported assets
        supportedAssets[0xA0b86a33E6411b8b7ce9c3a8b6C0C3C5a7F9d8c2] = true;
        supportedAssets[0xB0b86a33E6411b8b7ce9c3a8b6C0C3C5a7F9d8c3] = true;
    }

    /**
     * @dev Supply assets to Aave
     */
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) external nonReentrant onlySupportedAsset(asset) onlyAuthorizedUser {
        require(amount > 0, "Invalid amount");
        require(onBehalfOf != address(0), "Invalid recipient");
        
        // Transfer asset from user
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        
        // Approve pool to spend asset
        IERC20(asset).safeApprove(address(pool), amount);
        
        // Supply to Aave
        pool.supply(asset, amount, onBehalfOf, 0);
        
        // Update position
        _updateUserPosition(onBehalfOf);
        
        // Get aToken balance for event
        IAToken aToken = IAToken(_getReserveData(asset).aTokenAddress);
        uint256 aTokenAmount = aToken.balanceOf(onBehalfOf);
        
        emit Supplied(msg.sender, asset, amount, aTokenAmount);
    }

    /**
     * @dev Withdraw assets from Aave
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external nonReentrant onlySupportedAsset(asset) returns (uint256) {
        require(amount > 0, "Invalid amount");
        require(to != address(0), "Invalid recipient");
        
        // Withdraw from Aave
        uint256 withdrawnAmount = pool.withdraw(asset, amount, to);
        
        // Update position
        _updateUserPosition(msg.sender);
        
        // Get aToken balance for event
        IAToken aToken = IAToken(_getReserveData(asset).aTokenAddress);
        uint256 aTokenAmount = aToken.balanceOf(msg.sender);
        
        emit Withdrawn(msg.sender, asset, withdrawnAmount, aTokenAmount);
        
        return withdrawnAmount;
    }

    /**
     * @dev Borrow assets from Aave
     */
    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        address onBehalfOf
    ) external nonReentrant onlySupportedAsset(asset) onlyAuthorizedUser {
        require(amount > 0, "Invalid amount");
        require(onBehalfOf != address(0), "Invalid recipient");
        require(interestRateMode == 1 || interestRateMode == 2, "Invalid interest rate mode");
        
        // Check health factor before borrowing
        _updateUserPosition(onBehalfOf);
        require(userPositions[onBehalfOf].healthFactor > HEALTH_FACTOR_LIQUIDATION_THRESHOLD, "Insufficient health factor");
        
        // Borrow from Aave
        pool.borrow(asset, amount, interestRateMode, 0, onBehalfOf);
        
        // Update position
        _updateUserPosition(onBehalfOf);
        
        // Get debt token balance for event
        if (interestRateMode == 1) {
            // Variable rate
            IVariableDebtToken debtToken = IVariableDebtToken(_getReserveData(asset).variableDebtTokenAddress);
            uint256 debtAmount = debtToken.balanceOf(onBehalfOf);
            emit Borrowed(msg.sender, asset, amount, debtAmount, interestRateMode);
        } else {
            // Stable rate
            IStableDebtToken debtToken = IStableDebtToken(_getReserveData(asset).stableDebtTokenAddress);
            uint256 debtAmount = debtToken.balanceOf(onBehalfOf);
            emit Borrowed(msg.sender, asset, amount, debtAmount, interestRateMode);
        }
    }

    /**
     * @dev Repay borrowed assets
     */
    function repay(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        address onBehalfOf
    ) external nonReentrant onlySupportedAsset(asset) returns (uint256) {
        require(amount > 0, "Invalid amount");
        require(onBehalfOf != address(0), "Invalid recipient");
        require(interestRateMode == 1 || interestRateMode == 2, "Invalid interest rate mode");
        
        // Transfer repayment amount from user
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        
        // Approve pool to spend asset
        IERC20(asset).safeApprove(address(pool), amount);
        
        // Repay to Aave
        uint256 repaidAmount = pool.repay(asset, amount, interestRateMode, onBehalfOf);
        
        // Update position
        _updateUserPosition(onBehalfOf);
        
        // Get remaining debt balance for event
        if (interestRateMode == 1) {
            IVariableDebtToken debtToken = IVariableDebtToken(_getReserveData(asset).variableDebtTokenAddress);
            uint256 remainingDebt = debtToken.balanceOf(onBehalfOf);
            emit Repaid(msg.sender, asset, repaidAmount, remainingDebt);
        } else {
            IStableDebtToken debtToken = IStableDebtToken(_getReserveData(asset).stableDebtTokenAddress);
            uint256 remainingDebt = debtToken.balanceOf(onBehalfOf);
            emit Repaid(msg.sender, asset, repaidAmount, remainingDebt);
        }
        
        return repaidAmount;
    }

    /**
     * @dev Get user account data
     */
    function getUserAccountData(address user) external view returns (
        uint256 totalCollateral,
        uint256 totalDebt,
        uint256 availableBorrows,
        uint256 currentLTV,
        uint256 healthFactor,
        bool isLiquidatable
    ) {
        if (userPositions[user].lastUpdateTime == 0) {
            // Position not initialized, return current data
            (totalCollateral, totalDebt, availableBorrows, , currentLTV, healthFactor) = pool.getUserAccountData(user);
            isLiquidatable = healthFactor < HEALTH_FACTOR_LIQUIDATION_THRESHOLD;
        } else {
            UserPosition memory position = userPositions[user];
            return (position.totalCollateral, position.totalDebt, position.availableBorrows, 
                   position.currentLTV, position.healthFactor, position.isLiquidatable);
        }
    }

    /**
     * @dev Get asset configuration
     */
    function getAssetConfig(address asset) external view returns (
        bool isEnabled,
        bool canBeCollateral,
        bool canBeBorrowed,
        uint256 maxLTV,
        uint256 liquidationThreshold,
        uint256 liquidationBonus
    ) {
        AssetConfig memory config = assetConfigs[asset];
        
        if (config.isEnabled) {
            return (true, config.canBeCollateral, config.canBeBorrowed, 
                   config.maxLTV, config.liquidationThreshold, config.liquidationBonus);
        } else {
            // Return default values if not configured
            return (false, false, false, 0, 0, 0);
        }
    }

    /**
     * @dev Get reserve data for an asset
     */
    function getReserveData(address asset) external view returns (
        uint128 liquidityIndex,
        uint128 currentLiquidityRate,
        uint128 variableBorrowIndex,
        uint128 currentVariableBorrowRate,
        uint128 currentStableBorrowRate,
        address aTokenAddress,
        address variableDebtTokenAddress,
        address stableDebtTokenAddress
    ) {
        IPool.ReserveData memory data = _getReserveData(asset);
        return (data.liquidityIndex, data.currentLiquidityRate, data.variableBorrowIndex,
               data.currentVariableBorrowRate, data.currentStableBorrowRate,
               data.aTokenAddress, data.variableDebtTokenAddress, data.stableDebtTokenAddress);
    }

    /**
     * @dev Calculate maximum borrowable amount
     */
    function calculateMaxBorrow(address user, address asset) external view returns (uint256) {
        if (userPositions[user].lastUpdateTime == 0) {
            return 0;
        }
        
        // Get oracle price for the asset
        uint256 assetPrice = oracle.getAssetPrice(asset);
        uint256 userCollateral = userPositions[user].totalCollateral;
        
        if (userCollateral == 0) return 0;
        
        // Calculate max borrow based on LTV
        uint256 maxBorrowValue = userCollateral.mul(MAX_LTV).div(10000);
        return maxBorrowValue.div(assetPrice);
    }

    /**
     * @dev Calculate health factor
     */
    function calculateHealthFactor(address user) external view returns (uint256) {
        if (userPositions[user].totalDebt == 0) {
            return type(uint256).max;
        }
        
        uint256 liquidationThreshold = userPositions[user].totalCollateral.mul(LIQUIDATION_THRESHOLD).div(10000);
        return liquidationThreshold.mul(1e18).div(userPositions[user].totalDebt);
    }

    /**
     * @dev Update user position
     */
    function _updateUserPosition(address user) internal {
        (uint256 totalCollateral, uint256 totalDebt, uint256 availableBorrows, 
         , uint256 currentLTV, uint256 healthFactor) = pool.getUserAccountData(user);
        
        userPositions[user] = UserPosition({
            totalCollateral: totalCollateral,
            totalDebt: totalDebt,
            availableBorrows: availableBorrows,
            currentLTV: currentLTV,
            healthFactor: healthFactor,
            isLiquidatable: healthFactor < HEALTH_FACTOR_LIQUIDATION_THRESHOLD,
            lastUpdateTime: block.timestamp
        });
    }

    /**
     * @dev Get reserve data (internal)
     */
    function _getReserveData(address asset) internal view returns (IPool.ReserveData memory) {
        return pool.getReserveData(asset);
    }

    /**
     * @dev Add supported asset
     */
    function addSupportedAsset(address asset, bool canBeCollateral, bool canBeBorrowed) external onlyOwner {
        require(asset != address(0), "Invalid asset address");
        
        supportedAssets[asset] = true;
        assetConfigs[asset] = AssetConfig({
            isEnabled: true,
            canBeCollateral: canBeCollateral,
            canBeBorrowed: canBeBorrowed,
            maxLTV: MAX_LTV,
            liquidationThreshold: LIQUIDATION_THRESHOLD,
            liquidationBonus: LIQUIDATION_BONUS
        });
    }

    /**
     * @dev Remove supported asset
     */
    function removeSupportedAsset(address asset) external onlyOwner {
        supportedAssets[asset] = false;
        delete assetConfigs[asset];
    }

    /**
     * @dev Authorize user
     */
    function authorizeUser(address user) external onlyOwner {
        require(user != address(0), "Invalid user address");
        authorizedUsers[user] = true;
    }

    /**
     * @dev Revoke user authorization
     */
    function revokeUserAuthorization(address user) external onlyOwner {
        authorizedUsers[user] = false;
    }

    /**
     * @dev Update asset configuration
     */
    function updateAssetConfig(
        address asset,
        uint256 maxLTV,
        uint256 liquidationThreshold,
        uint256 liquidationBonus
    ) external onlyOwner {
        require(supportedAssets[asset], "Asset not supported");
        require(maxLTV <= 9000, "LTV too high");
        require(liquidationThreshold > maxLTV, "Invalid liquidation threshold");
        require(liquidationBonus >= 0 && liquidationBonus <= 2000, "Invalid liquidation bonus");
        
        assetConfigs[asset].maxLTV = maxLTV;
        assetConfigs[asset].liquidationThreshold = liquidationThreshold;
        assetConfigs[asset].liquidationBonus = liquidationBonus;
    }

    /**
     * @dev Emergency function to recover stuck tokens
     */
    function recoverStuckTokens(address token, uint256 amount) external onlyOwner {
        require(block.timestamp > 1735689600, "Emergency recovery locked");
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @dev View function to check if asset is supported
     */
    function isAssetSupported(address asset) external view returns (bool) {
        return supportedAssets[asset];
    }

    /**
     * @dev View function to check if user is authorized
     */
    function isUserAuthorized(address user) external view returns (bool) {
        return authorizedUsers[user] || user == owner();
    }
}
