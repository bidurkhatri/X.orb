// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ActionVerifier
 * @dev On-chain action hash anchoring for X.orb.
 *
 * Every action that passes the 8-gate pipeline has its audit hash
 * written on-chain. This creates an immutable, verifiable record
 * of agent behavior.
 *
 * Features:
 *   - Batch verification for gas efficiency
 *   - Action hash anchoring (SHA-256 of gate results stored on-chain)
 *   - Per-agent action count tracking
 *   - Verification status queries
 */
contract ActionVerifier is AccessControl, ReentrancyGuard, Pausable {

    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    // --- Types ---

    struct ActionRecord {
        bytes32 agentId;
        bytes32 actionHash;         // SHA-256 hash of gate results
        bytes32 auditCid;           // Optional IPFS CID of full audit data
        uint256 timestamp;
        bool verified;
    }

    // --- Storage ---

    uint256 public totalActions;
    mapping(bytes32 => ActionRecord) public actions;        // actionHash => record
    mapping(bytes32 => uint256) public agentActionCount;    // agentId => count
    mapping(bytes32 => bytes32[]) public agentActions;      // agentId => actionHash[]

    // --- Events ---

    event ActionAnchored(bytes32 indexed agentId, bytes32 indexed actionHash, uint256 timestamp);
    event ActionVerified(bytes32 indexed actionHash, address verifier);
    event BatchAnchored(uint256 count, uint256 timestamp);

    // --- Constructor ---

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    // --- Core Functions ---

    /**
     * @dev Anchor a single action hash on-chain.
     * @param agentId Agent that performed the action
     * @param actionHash SHA-256 hash of the gate results
     * @param auditCid Optional IPFS CID of full audit data
     */
    function anchorAction(
        bytes32 agentId,
        bytes32 actionHash,
        bytes32 auditCid
    ) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        require(actions[actionHash].timestamp == 0, "Action already anchored");

        actions[actionHash] = ActionRecord({
            agentId: agentId,
            actionHash: actionHash,
            auditCid: auditCid,
            timestamp: block.timestamp,
            verified: false
        });

        agentActionCount[agentId]++;
        agentActions[agentId].push(actionHash);
        totalActions++;

        emit ActionAnchored(agentId, actionHash, block.timestamp);
    }

    /**
     * @dev Batch anchor multiple action hashes for gas efficiency.
     * @param agentIds Array of agent IDs
     * @param actionHashes Array of action hashes
     * @param auditCids Array of IPFS CIDs
     */
    function batchAnchor(
        bytes32[] calldata agentIds,
        bytes32[] calldata actionHashes,
        bytes32[] calldata auditCids
    ) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        require(agentIds.length == actionHashes.length, "Array length mismatch");
        require(agentIds.length == auditCids.length, "Array length mismatch");
        require(agentIds.length <= 100, "Batch too large");

        for (uint256 i = 0; i < agentIds.length; i++) {
            if (actions[actionHashes[i]].timestamp != 0) continue; // skip duplicates

            actions[actionHashes[i]] = ActionRecord({
                agentId: agentIds[i],
                actionHash: actionHashes[i],
                auditCid: auditCids[i],
                timestamp: block.timestamp,
                verified: false
            });

            agentActionCount[agentIds[i]]++;
            agentActions[agentIds[i]].push(actionHashes[i]);
            totalActions++;
        }

        emit BatchAnchored(agentIds.length, block.timestamp);
    }

    /**
     * @dev Mark an action as verified (e.g., after human review).
     */
    function verifyAction(bytes32 actionHash) external onlyRole(VERIFIER_ROLE) {
        require(actions[actionHash].timestamp > 0, "Action not found");
        require(!actions[actionHash].verified, "Already verified");

        actions[actionHash].verified = true;
        emit ActionVerified(actionHash, msg.sender);
    }

    // --- Views ---

    function getAction(bytes32 actionHash) external view returns (ActionRecord memory) {
        return actions[actionHash];
    }

    function getAgentActionCount(bytes32 agentId) external view returns (uint256) {
        return agentActionCount[agentId];
    }

    function getAgentActions(bytes32 agentId, uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
        bytes32[] storage all = agentActions[agentId];
        if (offset >= all.length) return new bytes32[](0);

        uint256 end = offset + limit;
        if (end > all.length) end = all.length;
        uint256 size = end - offset;

        bytes32[] memory result = new bytes32[](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = all[offset + i];
        }
        return result;
    }

    function isAnchored(bytes32 actionHash) external view returns (bool) {
        return actions[actionHash].timestamp > 0;
    }

    // --- Admin ---

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
