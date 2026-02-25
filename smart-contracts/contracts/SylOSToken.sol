// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
        address taxWallet_,
        address liquidityWallet_
    ) 
        ERC20(name, symbol)
    {
        require(admin != address(0), "Admin cannot be zero address");
        require(taxWallet_ != address(0), "Tax wallet cannot be zero address");
        require(liquidityWallet_ != address(0), "Liquidity wallet cannot be zero address");

        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(TAX_MANAGER_ROLE, admin);

        // Mint initial supply to admin
        _mint(admin, initialSupply * 10**decimals());

        // Setup tax and liquidity wallets
        taxWallet = taxWallet_;
        liquidityWallet = liquidityWallet_;
    }

    /**
     * @dev Mint tokens to a specified address
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) 
        external 
        onlyRole(MINTER_ROLE) 
        whenNotPaused 
    {
        require(to != address(0), "Cannot mint to zero address");
        _mint(to, amount);
    }

    /**
     * @dev Batch mint tokens to multiple addresses
     * @param recipients Array of addresses to mint to
     * @param amounts Array of amounts to mint
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) 
        external 
        onlyRole(MINTER_ROLE) 
        whenNotPaused 
    {
        require(recipients.length == amounts.length, "Array length mismatch");
        require(recipients.length <= 100, "Batch size too large");

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient address");
            _mint(recipients[i], amounts[i]);
        }
    }

    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Pausable) {
        super._beforeTokenTransfer(from, to, amount);
        
        // Anti-bot protection
        if (from != address(0) && to != address(0)) {
            require(
                block.number >= lastTransactionBlock[to].add(TRANSACTION_DELAY),
                "Transaction too frequent"
            );
            lastTransactionBlock[to] = block.number;
        }
    }

    /**
     * @dev Transfer with tax collection - protected against reentrancy
     */
    function _transfer(address from, address to, uint256 amount) internal virtual override whenNotPaused {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        require(amount > 0, "Transfer amount must be greater than 0");
        require(from != to, "Cannot transfer to self");
        require(amount <= balanceOf(from), "Insufficient balance");

        // Check for contract interactions
        if (isContract(to)) {
            require(!paused(), "Contract interactions paused");
        }

        // Calculate and collect tax
        uint256 tax = 0;
        uint256 transferAmount = amount;
        
        if (taxRate > 0 && amount > 100) { // Minimum threshold to avoid dust attacks
            tax = (amount * taxRate) / 10000;
            
            // Prevent tax from being too high
            require(tax < amount, "Invalid tax calculation");
            
            transferAmount = amount - tax;
            
            // Split tax between liquidity and general tax wallet
            uint256 liquidityTax = (tax * liquidityTaxShare) / 1000;
            uint256 generalTax = tax - liquidityTax;

            // State updates before external calls (Checks-Effects-Interactions pattern)
            totalTaxesCollected += tax;
            
            // Perform transfers (external calls)
            super._transfer(from, liquidityWallet, liquidityTax);
            super._transfer(from, taxWallet, generalTax);
            
            emit TaxCollected(from, to, amount, tax);
        }

        // Transfer remaining amount
        super._transfer(from, to, transferAmount);
    }

    /**
     * @dev Pause all token transfers
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause all token transfers
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Update tax rate
     * @param newTaxRate New tax rate in basis points
     */
    function updateTaxRate(uint256 newTaxRate) external onlyRole(TAX_MANAGER_ROLE) {
        require(newTaxRate <= MAX_TAX_RATE, "Tax rate too high");
        uint256 oldRate = taxRate;
        taxRate = newTaxRate;
        emit TaxRateUpdated(oldRate, newTaxRate);
    }

    /**
     * @dev Update tax wallet
     * @param newTaxWallet New tax wallet address
     */
    function updateTaxWallet(address newTaxWallet) external onlyRole(TAX_MANAGER_ROLE) {
        require(newTaxWallet != address(0), "Invalid tax wallet");
        address oldWallet = taxWallet;
        taxWallet = newTaxWallet;
        emit TaxWalletUpdated(oldWallet, newTaxWallet);
    }

    /**
     * @dev Update liquidity tax share
     * @param newShare New liquidity tax share percentage
     */
    function updateLiquidityShare(uint256 newShare) external onlyRole(TAX_MANAGER_ROLE) {
        require(newShare <= MAX_LIQUIDITY_TAX_SHARE, "Liquidity share too high");
        uint256 oldShare = liquidityTaxShare;
        liquidityTaxShare = newShare;
        emit LiquidityShareUpdated(oldShare, newShare);
    }

    /**
     * @dev Update liquidity wallet
     * @param newLiquidityWallet New liquidity wallet address
     */
    function updateLiquidityWallet(address newLiquidityWallet) external onlyRole(TAX_MANAGER_ROLE) {
        require(newLiquidityWallet != address(0), "Invalid liquidity wallet");
        address oldWallet = liquidityWallet;
        liquidityWallet = newLiquidityWallet;
        emit LiquidityWalletUpdated(oldWallet, newLiquidityWallet);
    }

    /**
     * @dev Withdraw accumulated taxes (emergency function) - protected against reentrancy
     * @param amount Amount of tokens to withdraw
     */
    function withdrawTaxes(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= totalTaxesCollected, "Amount exceeds available taxes");
        require(amount <= balanceOf(address(this)), "Insufficient contract balance");
        
        // State updates before external calls (Checks-Effects-Interactions pattern)
        totalTaxesCollected -= amount;
        
        // Perform transfer (external call)
        super._transfer(address(this), msg.sender, amount);
    }

    /**
     * @dev Get current tax rate in percentage
     */
    function getTaxRate() external view returns (uint256) {
        return taxRate / 100; // Convert from basis points to percentage
    }
    
    /**
     * @dev Check if address is a contract
     * @param account Address to check
     */
    function isContract(address account) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }

    /**
     * @dev Emergency function to recover accidentally sent tokens
     * @param tokenAddress Token address to recover
     * @param amount Amount of tokens to recover
     */
    function recoverTokens(address tokenAddress, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(tokenAddress != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");
        require(tokenAddress != address(this), "Cannot recover self tokens");
        
        IERC20(tokenAddress).transfer(msg.sender, amount);
    }

    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {
        // Accept ETH for manual liquidity addition
    }

    /**
     * @dev Withdraw ETH (emergency function)
     */
    function withdrawETH() external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        payable(msg.sender).transfer(balance);
    }

    /**
     * @dev Get contract balance
     */
    function getContractBalance() external view returns (uint256) {
        return balanceOf(address(this));
    }
}
