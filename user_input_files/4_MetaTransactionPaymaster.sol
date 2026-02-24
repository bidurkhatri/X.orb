// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MetaTransactionPaymaster
 * @notice Executes EIP-712 signed meta-transactions and collects payment
 *         either in ETH (msg.value) or an ERC20 token from the signer.
 *
 * Security notes:
 * - The call to `metaTx.to` is performed with user-provided calldata and gas.
 *   Only use this on trusted targets, or add allowlists.
 * - ERC20 payments require prior approval by `metaTx.from`.
 * - ETH overpayment is refunded to msg.sender; exact charge is retained.
 */
contract MetaTransactionPaymaster is AccessControl, ReentrancyGuard, EIP712 {
    // ---- Roles ----
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    // ---- MetaTx struct & typehash (EIP-712) ----
    struct MetaTransaction {
        uint256 nonce;           // must match nonces[from]
        address from;            // signer who authorizes the call
        uint256 chainId;         // chain binding
        address to;              // target to call
        bytes data;              // calldata for the target
        uint256 gasLimit;        // gas forwarded to target call
        uint256 gasPrice;        // OPTIONAL field for offchain accounting
        address paymentToken;    // address(0) for ETH, or ERC20 token address
        uint256 paymentAmount;   // how much to charge
    }

    bytes32 public constant META_TRANSACTION_TYPEHASH = keccak256(
        "MetaTransaction(uint256 nonce,address from,uint256 chainId,address to,bytes data,uint256 gasLimit,uint256 gasPrice,address paymentToken,uint256 paymentAmount)"
    );

    // ---- State ----
    mapping(address => uint256) public nonces; // signer => next expected nonce

    // ---- Events ----
    event MetaTransactionExecuted(
        address indexed from,
        address indexed to,
        uint256 valueCharged,
        address paymentToken,
        uint256 paymentAmount,
        bool success,
        bytes returnData
    );

    event WithdrawnETH(address indexed to, uint256 amount);
    event WithdrawnToken(address indexed token, address indexed to, uint256 amount);

    // ---- Constructor ----
    constructor(address admin)
        EIP712("MetaTransactionPaymaster", "1")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
    }

    // ---- Public view helpers ----
    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    function hashMetaTransaction(MetaTransaction calldata metaTx) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
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
            )
        );
        return _hashTypedDataV4(structHash);
    }

    function recoverSigner(MetaTransaction calldata metaTx, bytes calldata signature)
        public
        view
        returns (address)
    {
        return ECDSA.recover(hashMetaTransaction(metaTx), signature);
    }

    // ---- Core executor ----

    /**
     * @notice Executes a signed meta-transaction and collects payment.
     * @dev This function is payable because ETH payments use msg.value.
     *      Excess msg.value (if any) is refunded to msg.sender.
     */
    function executeMetaTransaction(
        MetaTransaction calldata metaTx,
        bytes calldata signature
    )
        external
        payable
        nonReentrant
        returns (bytes memory)
    {
        // 1) Basic checks
        require(metaTx.chainId == block.chainid, "chainId mismatch");
        require(nonces[metaTx.from] == metaTx.nonce, "bad nonce");

        // 2) Verify EIP-712 signature
        address signer = recoverSigner(metaTx, signature);
        require(signer == metaTx.from, "invalid signature");

        // 3) Bump nonce *before* external effects
        unchecked { nonces[metaTx.from] = metaTx.nonce + 1; }

        // 4) Collect payment
        if (metaTx.paymentToken == address(0)) {
            // ETH path
            require(msg.value >= metaTx.paymentAmount, "insufficient ETH sent");

            // Refund excess ETH to msg.sender (the relayer)
            uint256 refund = msg.value - metaTx.paymentAmount;
            if (refund > 0) {
                (bool rs, ) = payable(msg.sender).call{value: refund}("");
                require(rs, "refund failed");
            }
        } else {
            // ERC20 path: user must have approved `paymentAmount` to this contract
            require(
                IERC20(metaTx.paymentToken).transferFrom(metaTx.from, address(this), metaTx.paymentAmount),
                "token payment failed"
            );
        }

        // 5) Perform the call to target
        (bool ok, bytes memory ret) = metaTx.to.call{gas: metaTx.gasLimit}(metaTx.data);

        // 6) Emit and bubble up revert reason if failed
        emit MetaTransactionExecuted(
            metaTx.from,
            metaTx.to,
            metaTx.paymentToken == address(0) ? metaTx.paymentAmount : 0,
            metaTx.paymentToken,
            metaTx.paymentAmount,
            ok,
            ret
        );

        if (!ok) {
            // Bubble revert data
            assembly {
                revert(add(ret, 0x20), mload(ret))
            }
        }

        return ret;
    }

    // ---- Admin withdrawals ----

    function withdrawETH(address to, uint256 amount) external nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "zero to");
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "ETH withdraw failed");
        emit WithdrawnETH(to, amount);
    }

    function withdrawToken(address token, address to, uint256 amount)
        external
        nonReentrant
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(to != address(0), "zero to");
        require(IERC20(token).transfer(to, amount), "token withdraw failed");
        emit WithdrawnToken(token, to, amount);
    }

    // ---- Receive ----
    receive() external payable {}
}
