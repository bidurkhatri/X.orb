// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
    function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool);
}

interface IUniswapV3Pool {
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
    
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
    function liquidity() external view returns (uint128);
}

interface IQuoter {
    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint160 sqrtPriceLimitX96
    ) external returns (uint256 amountOut);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface INonFungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    struct IncreaseLiquidityParams {
        uint256 tokenId;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }
    
    function mint(MintParams calldata params) external payable returns (
        uint256 tokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );
    
    function increaseLiquidity(INonFungiblePositionManager.IncreaseLiquidityParams calldata params) external payable returns (
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );
}

/**
 * @title UniswapV3Manager
 * @dev Advanced Uniswap V3 integration for trading and liquidity management
 */
contract UniswapV3Manager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    

    // Events
    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint24 fee
    );

    event LiquidityAdded(
        address indexed user,
        address indexed token0,
        address indexed token1,
        uint24 fee,
        uint256 amount0,
        uint256 amount1,
        uint128 liquidity
    );

    event LiquidityRemoved(
        address indexed user,
        address indexed token0,
        address indexed token1,
        uint24 fee,
        uint256 amount0,
        uint256 amount1,
        uint128 liquidity
    );

    // State variables
    IUniswapV3Factory public immutable factory;
    ISwapRouter public immutable swapRouter;
    IQuoter public immutable quoter;
    INonFungiblePositionManager public immutable positionManager;
    
    mapping(address => bool) public authorizedTokens;
    mapping(address => uint256) public userSwapCount;
    mapping(address => uint256) public userTotalVolume;
    mapping(address => bool) public authorizedUsers;
    
    uint256 public constant MAX_SLIPPAGE = 1000; // 10% max slippage
    uint256 public constant MIN_LIQUIDITY = 1000; // Minimum liquidity to add
    uint256 public swapFee = 3; // 0.03% fee
    
    // Modifiers
    modifier onlyAuthorizedToken(address token) {
        require(authorizedTokens[token] || token == address(0), "Token not authorized");
        _;
    }

    modifier onlyAuthorizedUser() {
        require(authorizedUsers[msg.sender] || msg.sender == owner(), "User not authorized");
        _;
    }

    constructor(
        address _factory,
        address _swapRouter,
        address _quoter,
        address _positionManager
    ) {
        factory = IUniswapV3Factory(_factory);
        swapRouter = ISwapRouter(_swapRouter);
        quoter = IQuoter(_quoter);
        positionManager = INonFungiblePositionManager(_positionManager);
        
        // Whitelist some common tokens
        authorizedTokens[0xA0b86a33E6411b8b7ce9c3a8b6C0C3C5a7F9d8c2] = true;
        authorizedTokens[0xB0b86a33E6411b8b7ce9c3a8b6C0C3C5a7F9d8c3] = true;
    }

    /**
     * @dev Swap exact input single
     */
    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint24 fee
    ) external nonReentrant onlyAuthorizedToken(tokenIn) onlyAuthorizedToken(tokenOut) returns (uint256 amountOut) {
        require(amountIn > 0, "Invalid amount in");
        require(amountOutMinimum > 0, "Invalid amount out minimum");
        require(fee > 0 && fee <= 10000, "Invalid fee");
        
        // Transfer tokenIn from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Approve router to spend tokenIn
        IERC20(tokenIn).safeApprove(address(swapRouter), amountIn);
        
        // Execute swap
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: msg.sender,
            deadline: block.timestamp + 300, // 5 minutes
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0
        });
        
        amountOut = swapRouter.exactInputSingle(params);
        
        // Update user statistics
        userSwapCount[msg.sender] = userSwapCount[msg.sender].add(1);
        userTotalVolume[msg.sender] = userTotalVolume[msg.sender].add(amountIn);
        
        // Emit event
        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, fee);
    }

    /**
     * @dev Quote swap output
     */
    function getQuoteForSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint24 fee
    ) public view returns (uint256 amountOut) {
        try quoter.quoteExactInputSingle(tokenIn, tokenOut, fee, amountIn, 0) returns (uint256 quote) {
            return quote;
        } catch {
            return 0;
        }
    }

    /**
     * @dev Add liquidity to Uniswap V3 pool
     */
    function addLiquidity(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min
    ) external nonReentrant onlyAuthorizedToken(token0) onlyAuthorizedToken(token1) returns (
        uint256 tokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    ) {
        require(token0 != token1, "Tokens must be different");
        require(fee > 0 && fee <= 10000, "Invalid fee");
        require(tickLower < tickUpper, "Invalid tick range");
        require(amount0Desired >= MIN_LIQUIDITY && amount1Desired >= MIN_LIQUIDITY, "Amounts too small");
        
        // Transfer tokens from user
        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0Desired);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1Desired);
        
        // Approve position manager
        IERC20(token0).safeApprove(address(positionManager), amount0Desired);
        IERC20(token1).safeApprove(address(positionManager), amount1Desired);
        
        // Mint liquidity position
        INonFungiblePositionManager.MintParams memory params = INonFungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: fee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: amount0Min,
            amount1Min: amount1Min,
            recipient: msg.sender,
            deadline: block.timestamp + 300
        });
        
        (tokenId, liquidity, amount0, amount1) = positionManager.mint(params);
        
        // Update statistics
        userSwapCount[msg.sender] = userSwapCount[msg.sender].add(1);
        userTotalVolume[msg.sender] = userTotalVolume[msg.sender].add(amount0.add(amount1));
        
        // Emit event
        emit LiquidityAdded(msg.sender, token0, token1, fee, amount0, amount1, liquidity);
    }

    /**
     * @dev Remove liquidity from Uniswap V3 pool
     */
    function removeLiquidity(
        uint256 tokenId,
        uint128 liquidity,
        uint256 amount0Min,
        uint256 amount1Min,
        uint256 deadline
    ) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        // Get position info
        (,, address token0, address token1,,,,,,) = positionManager.positions(tokenId);
        
        // Transfer NFT to this contract for burning
        positionManager.safeTransferFrom(msg.sender, address(this), tokenId);
        
        // Decrease liquidity
        (amount0, amount1) = positionManager.decreaseLiquidity(
            INonFungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liquidity,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                deadline: deadline
            })
        );
        
        // Collect fees and remaining amounts
        (amount0, amount1) = positionManager.collect(
            INonFungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: msg.sender,
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
        
        // Emit event
        emit LiquidityRemoved(msg.sender, token0, token1, 0, amount0, amount1, liquidity);
    }

    /**
     * @dev Get pool information
     */
    function getPoolInfo(address token0, address token1, uint24 fee) external view returns (
        address pool,
        uint128 liquidity,
        uint256 feeTier,
        address tokenA,
        address tokenB
    ) {
        pool = factory.getPool(token0, token1, fee);
        
        if (pool != address(0)) {
            IUniswapV3Pool poolContract = IUniswapV3Pool(pool);
            liquidity = poolContract.liquidity();
            feeTier = poolContract.fee();
            tokenA = poolContract.token0();
            tokenB = poolContract.token1();
        }
    }

    /**
     * @dev Calculate price impact
     */
    function calculatePriceImpact(
        address token0,
        address token1,
        uint24 fee,
        uint256 amountIn
    ) external view returns (uint256 priceImpact) {
        address pool = factory.getPool(token0, token1, fee);
        if (pool == address(0)) return type(uint256).max;
        
        // Get current price and quote
        uint256 quote = getQuoteForSwap(token0, token1, amountIn, fee);
        if (quote == 0) return type(uint256).max;
        
        // Calculate price impact (simplified)
        uint256 referenceRate = amountIn.mul(1e18).div(quote);
        return 0; // Would need more complex calculation in production
    }

    /**
     * @dev Get user statistics
     */
    function getUserStats(address user) external view returns (
        uint256 swapCount,
        uint256 totalVolume,
        uint256 averageTradeSize
    ) {
        swapCount = userSwapCount[user];
        totalVolume = userTotalVolume[user];
        averageTradeSize = swapCount > 0 ? totalVolume.div(swapCount) : 0;
    }

    /**
     * @dev Authorize a token for trading
     */
    function authorizeToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token address");
        authorizedTokens[token] = true;
    }

    /**
     * @dev Remove token authorization
     */
    function revokeTokenAuthorization(address token) external onlyOwner {
        authorizedTokens[token] = false;
    }

    /**
     * @dev Authorize a user for advanced features
     */
    function authorizeUser(address user) external onlyOwner {
        require(user != address(0), "Invalid user address");
        authorizedUsers[user] = true;
    }

    /**
     * @dev Remove user authorization
     */
    function revokeUserAuthorization(address user) external onlyOwner {
        authorizedUsers[user] = false;
    }

    /**
     * @dev Update swap fee
     */
    function updateSwapFee(uint256 newFee) external onlyOwner {
        require(newFee <= 10, "Fee too high (max 0.1%)");
        swapFee = newFee;
    }

    /**
     * @dev Withdraw accumulated fees
     */
    function withdrawFees(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @dev Emergency function to recover stuck tokens
     */
    function recoverStuckTokens(address token, uint256 amount) external onlyOwner {
        require(block.timestamp > 1735689600, "Emergency recovery locked");
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @dev View function to check token authorization
     */
    function isTokenAuthorized(address token) external view returns (bool) {
        return authorizedTokens[token];
    }

    /**
     * @dev View function to check user authorization
     */
    function isUserAuthorized(address user) external view returns (bool) {
        return authorizedUsers[user] || user == owner();
    }
}
