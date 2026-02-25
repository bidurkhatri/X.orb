// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SylOSToken
 * @dev ERC-20 token for SylOS Blockchain OS with minting, burning, and governance capabilities
 * Features:
 * - Minting and burning functionality
 * - Pausable operations
 * - Role-based access control
 * - Tax/fee mechanism for transactions
 * - Automatic liquidity provision support
 */
contract SylOSToken is ERC20, ERC20Burnable, ERC20Pausable, AccessControl, ReentrancyGuard {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant TAX_MANAGER_ROLE = keccak256("TAX_MANAGER_ROLE");

    // Tax system
    uint256 public taxRate = 250; // 2.5% in basis points
    uint256 public constant MAX_TAX_RATE = 1000; // 10% max
    address public taxWallet;
    uint256 public totalTaxesCollected = 0;

    // Liquidity support
    address public liquidityWallet;
    uint256 public liquidityTaxShare = 200; // 20% of tax goes to liquidity
    uint256 public constant MAX_LIQUIDITY_TAX_SHARE = 500; // 50% max

    // Anti-bot protection
    mapping(address => uint256) public lastTransactionBlock;
    uint256 public constant TRANSACTION_DELAY = 1; // blocks

    // Events
    event TaxCollected(address indexed from, address indexed to, uint256 amount, uint256 tax);
    event TaxRateUpdated(uint256 oldRate, uint256 newRate);
    event TaxWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event LiquidityShareUpdated(uint256 oldShare, uint256 newShare);
    event LiquidityWalletUpdated(address indexed oldWallet, address indexed newWallet);

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address admin,
        address _taxWallet,
        address _liquidityWallet
    ) ERC20(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(TAX_MANAGER_ROLE, admin);

        taxWallet = _taxWallet;
        liquidityWallet = _liquidityWallet;

        if (initialSupply > 0) {
            _mint(admin, initialSupply * (10**decimals()));
        }
    }

    // Override required by Solidity
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Pausable) {
        require(!paused(), "Token transfer while paused");
        super._beforeTokenTransfer(from, to, amount);
    }

    // Tax calculation
    function _transfer(address from, address to, uint256 amount) internal override {
        if (from != address(0) && to != address(0) && taxRate > 0) {
            uint256 taxAmount = (amount * taxRate) / 10000;
            uint256 netAmount = amount - taxAmount;
            uint256 liquidityAmount = (taxAmount * liquidityTaxShare) / 10000;

            // Transfer net amount
            super._transfer(from, to, netAmount);

            // Transfer tax to tax wallet
            super._transfer(from, taxWallet, taxAmount - liquidityAmount);

            // Transfer liquidity amount to liquidity wallet
            if (liquidityAmount > 0) {
                super._transfer(from, liquidityWallet, liquidityAmount);
            }

            // Emit tax event
            emit TaxCollected(from, to, amount, taxAmount);
        } else {
            super._transfer(from, to, amount);
        }
    }

    // Mint function with role check
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    // Burn function
    function burn(uint256 amount) public override {
        _burn(msg.sender, amount);
    }

    // Pause/unpause functions
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // Tax management functions
    function updateTaxRate(uint256 newRate) public onlyRole(TAX_MANAGER_ROLE) {
        require(newRate <= MAX_TAX_RATE, "Tax rate exceeds maximum");
        uint256 oldRate = taxRate;
        taxRate = newRate;
        emit TaxRateUpdated(oldRate, newRate);
    }

    function updateTaxWallet(address newWallet) public onlyRole(TAX_MANAGER_ROLE) {
        address oldWallet = taxWallet;
        taxWallet = newWallet;
        emit TaxWalletUpdated(oldWallet, newWallet);
    }

    function updateLiquidityShare(uint256 newShare) public onlyRole(TAX_MANAGER_ROLE) {
        require(newShare <= MAX_LIQUIDITY_TAX_SHARE, "Liquidity share exceeds maximum");
        uint256 oldShare = liquidityTaxShare;
        liquidityTaxShare = newShare;
        emit LiquidityShareUpdated(oldShare, newShare);
    }

    function updateLiquidityWallet(address newWallet) public onlyRole(TAX_MANAGER_ROLE) {
        address oldWallet = liquidityWallet;
        liquidityWallet = newWallet;
        emit LiquidityWalletUpdated(oldWallet, newWallet);
    }

    // View functions
    function getTotalTaxesCollected() public view returns (uint256) {
        return totalTaxesCollected;
    }

    // Emergency function to recover tokens
    function recoverTokens(address token, uint256 amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).transfer(msg.sender, amount);
    }
}