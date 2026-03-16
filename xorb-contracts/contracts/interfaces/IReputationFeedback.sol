// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IReputationFeedback
 * @dev ERC-8004 compatible reputation feedback interface.
 *
 * This interface allows cross-platform reputation queries and
 * feedback submission, compatible with the ERC-8004 standard
 * for on-chain agent reputation.
 */
interface IReputationFeedback {
    struct Feedback {
        bytes32 fromAgent;      // Agent giving feedback
        bytes32 toAgent;        // Agent receiving feedback
        uint256 score;          // 0-100 score
        string[] tags;          // Context tags (e.g., "reliable", "fast", "accurate")
        string context;         // Description of the interaction
        uint256 timestamp;
    }

    event FeedbackSubmitted(
        bytes32 indexed fromAgent,
        bytes32 indexed toAgent,
        uint256 score,
        uint256 timestamp
    );

    /**
     * @dev Submit feedback for an agent.
     */
    function submitFeedback(
        bytes32 fromAgent,
        bytes32 toAgent,
        uint256 score,
        string[] calldata tags,
        string calldata context
    ) external;

    /**
     * @dev Get the reputation score for an agent.
     */
    function getReputation(bytes32 agentId) external view returns (
        uint256 score,
        uint256 totalFeedback,
        uint256 positiveFeedback,
        uint256 negativeFeedback
    );

    /**
     * @dev Get feedback records for an agent.
     */
    function getFeedback(bytes32 agentId, uint256 offset, uint256 limit)
        external view returns (Feedback[] memory);

    /**
     * @dev Check if this contract supports ERC-8004.
     */
    function supportsERC8004() external pure returns (bool);
}
