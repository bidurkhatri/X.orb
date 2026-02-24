// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Wrapper} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Wrapper.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract WrappedSYLOS is
    ERC20Wrapper,        // Provides depositFor / withdrawTo (wrap/unwrap)
    ERC20Burnable,       // Optional: allows burning wrapped tokens
    ERC20Pausable,       // Adds pause/unpause for transfers
    AccessControl,
    ReentrancyGuard
{
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    constructor(
        string memory name_,
        string memory symbol_,
        IERC20 underlyingToken,
        address admin
    )
        ERC20(name_, symbol_)          // base ERC20
        ERC20Wrapper(underlyingToken)  // wrapper needs underlying
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // --- Pause controls ---
    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    // --- Required overrides (OZ v5) ---

    // Resolve ERC20 ↔ ERC20Pausable diamond
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }

    // Resolve ERC20 ↔ ERC20Wrapper decimals
    function decimals()
        public
        view
        override(ERC20, ERC20Wrapper)
        returns (uint8)
    {
        return super.decimals();
    }

    // AccessControl interface support
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // --- Notes ---
    // - Wrap:    depositFor(account, amount) after approving underlying to this contract.
    // - Unwrap:  withdrawTo(account, amount).
    // - Pausing halts transfers, deposits (wraps), and withdrawals (unwraps).
    // - Keeps 1:1 peg with underlying token.
}
