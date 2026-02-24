# SylOS Smart Contracts - Complete API Reference

## SylOSToken (SYLOS)

### Core Functions

#### `mint(address to, uint256 amount)`
Mints new SYLOS tokens to the specified address.

**Parameters:**
- `to` (address): Recipient of the minted tokens
- `amount` (uint256): Amount of tokens to mint

**Requirements:**
- Caller must have MINTER_ROLE
- Token not paused
- Recipient cannot be zero address

**Events:**
- `Transfer(address(0), to, amount)`

#### `batchMint(address[] recipients, uint256[] amounts)`
Batch mints tokens to multiple recipients.

**Parameters:**
- `recipients` (address[]): Array of recipient addresses
- `amounts` (uint256[]): Array of amounts to mint

**Requirements:**
- Array lengths must match
- Batch size limited to 100
- Caller must have MINTER_ROLE

#### `burn(uint256 amount)`
Burns tokens from the caller's balance.

**Parameters:**
- `amount` (uint256): Amount of tokens to burn

**Requirements:**
- Caller must have sufficient balance
- Token not paused

#### `burnFrom(address from, uint256 amount)`
Burns tokens from an approved address.

**Parameters:**
- `from` (address): Address to burn tokens from
- `amount` (uint256): Amount of tokens to burn

**Requirements:**
- Sufficient allowance from `from`
- `from` must have sufficient balance

#### `transfer(address to, uint256 amount)`
Transfers tokens with automatic tax collection.

**Parameters:**
- `to` (address): Recipient of the transfer
- `amount` (uint256): Amount to transfer

**Behavior:**
- Collects tax (default 2.5%)
- Splits tax between liquidity and general treasury
- Includes anti-bot protection

### Tax Management

#### `updateTaxRate(uint256 newTaxRate)`
Updates the tax rate for transfers.

**Parameters:**
- `newTaxRate` (uint256): New tax rate in basis points (1% = 100)

**Requirements:**
- Caller must have TAX_MANAGER_ROLE
- Rate must be ≤ MAX_TAX_RATE (1000 = 10%)

#### `updateTaxWallet(address newTaxWallet)`
Updates the tax collection wallet.

**Parameters:**
- `newTaxWallet` (address): New tax wallet address

**Requirements:**
- Caller must have TAX_MANAGER_ROLE
- Address cannot be zero

#### `updateLiquidityShare(uint256 newShare)`
Updates the percentage of tax going to liquidity wallet.

**Parameters:**
- `newShare` (uint256): New liquidity share (basis points)

**Requirements:**
- Caller must have TAX_MANAGER_ROLE
- Share must be ≤ MAX_LIQUIDITY_TAX_SHARE

### Emergency Functions

#### `withdrawTaxes(uint256 amount)`
Withdraws accumulated taxes to admin.

**Parameters:**
- `amount` (uint256): Amount to withdraw

**Requirements:**
- Caller must have DEFAULT_ADMIN_ROLE
- Amount ≤ total taxes collected

#### `recoverTokens(address tokenAddress, uint256 amount)`
Recovers accidentally sent tokens.

**Parameters:**
- `tokenAddress` (address): Token to recover
- `amount` (uint256): Amount to recover

**Requirements:**
- Caller must have DEFAULT_ADMIN_ROLE

#### `withdrawETH()`
Withdraws accumulated ETH.

**Requirements:**
- Caller must have DEFAULT_ADMIN_ROLE

### View Functions

#### `getTaxRate()` → uint256
Returns tax rate as percentage.

#### `getContractBalance()` → uint256
Returns contract's SYLOS token balance.

#### `totalTaxesCollected()` → uint256
Returns total taxes collected across all transfers.

## WrappedSYLOS (wSYLOS)

### Wrapping/Unwrapping

#### `wrap(uint256 amount)`
Wraps SYLOS tokens to create wSYLOS.

**Parameters:**
- `amount` (uint256): Amount of SYLOS to wrap

**Behavior:**
- Transfers SYLOS from user
- Mints equivalent wSYLOS
- Updates staking start time if first wrap

#### `unwrap(uint256 amount)`
Unwraps wSYLOS back to SYLOS.

**Parameters:**
- `amount` (uint256): Amount of wSYLOS to unwrap

**Requirements:**
- Cannot unwrap time-locked amounts
- Must have sufficient balance

### Staking and Rewards

#### `timeLock(uint256 amount, uint256 lockDurationIndex)`
Time-locks tokens for bonus rewards.

**Parameters:**
- `amount` (uint256): Amount to lock
- `lockDurationIndex` (uint256): Index of lock duration

**Behavior:**
- Applies time-locked bonus
- Prevents withdrawal until lock period ends

#### `claimTimeLocked(uint256 lockDurationIndex)`
Claims time-locked tokens after lock period.

**Parameters:**
- `lockDurationIndex` (uint256): Index of lock duration to claim

**Requirements:**
- Lock period must have expired
- Must have locked tokens in this duration

#### `claimRewards()`
Claims accumulated reward tokens.

**Behavior:**
- Calculates and mints reward tokens
- Resets user's reward balance

#### `getPendingRewards(address user)` → uint256
Returns pending reward amount for a user.

**Parameters:**
- `user` (address): User address to check

### Staking Management

#### `getStakingMultiplier(address user)` → uint256
Returns staking bonus multiplier for a user.

**Parameters:**
- `user` (address): User address to check

**Returns:**
- Multiplier in basis points (10000 = 1x, 11000 = 1.1x)

#### `getTimeLockedAmounts(address user)` → uint256[]
Returns all time-locked amounts for a user.

**Parameters:**
- `user` (address): User address to check

### Admin Functions

#### `setRewardPeriod(uint256 startTime, uint256 endTime, uint256 rewardRate)`
Sets the reward distribution period.

**Parameters:**
- `startTime` (uint256): Start timestamp
- `endTime` (uint256): End timestamp
- `rewardRate` (uint256): Rewards per second

**Requirements:**
- Caller must have REWARD_MANAGER_ROLE
- startTime < endTime

#### `addStakingBonus(uint256 minDuration, uint256 bonusMultiplier)`
Adds a new staking bonus tier.

**Parameters:**
- `minDuration` (uint256): Minimum staking duration (seconds)
- `bonusMultiplier` (uint256): Bonus in basis points

#### `addTimeLockBonus(uint256 lockDuration, uint256 bonusRate)`
Adds a new time-lock bonus tier.

**Parameters:**
- `lockDuration` (uint256): Lock duration (seconds)
- `bonusRate` (uint256): Bonus rate (basis points)

## PoPTracker

### Task Management

#### `createTask(string taskDescription, uint256 estimatedHours, uint256 complexity)` → uint256
Creates a new productivity task.

**Parameters:**
- `taskDescription` (string): Description of the task
- `estimatedHours` (uint256): Estimated hours to complete
- `complexity` (uint256): Complexity level (1-10)

**Returns:**
- `taskId` (uint256): ID of the created task

**Requirements:**
- Caller must have MANAGER_ROLE
- Complexity between 1-10

#### `completeTask(uint256 taskId, uint256 actualHours, uint256 qualityScore, string deliverableHash)`
Marks a task as completed.

**Parameters:**
- `taskId` (uint256): ID of the task
- `actualHours` (uint256): Actual hours spent
- `qualityScore` (uint256): Quality score (0-1000)
- `deliverableHash` (string): IPFS hash of deliverable

**Requirements:**
- Task must exist and not be completed
- Quality score ≤ 1000

### Productivity Tracking

#### `recordProductivity(address user, ProductivityMetrics metrics, string evidence)`
Records productivity metrics for a user.

**Parameters:**
- `user` (address): User to record productivity for
- `metrics` (ProductivityMetrics): Productivity metrics
- `evidence` (string): IPFS hash of evidence

**Requirements:**
- Caller must have VERIFIER_ROLE
- All metrics must be ≤ 1000

#### `verifyRecord(address user, uint256 recordId)`
Verifies a productivity record.

**Parameters:**
- `user` (address): User who recorded productivity
- `recordId` (uint256): ID of the record to verify

**Requirements:**
- Caller must have VALIDATOR_ROLE
- Record must exist and not be verified

### Reward Distribution

#### `distributeRewards()`
Distributes rewards for the current cycle.

**Requirements:**
- Caller must have MANAGER_ROLE
- Current cycle must have ended
- Rewards not already distributed

#### `withdrawRewards()`
Withdraws accumulated rewards.

**Requirements:**
- Must have pending rewards
- Previous cycle rewards must be distributed

### Configuration

#### `updateWeights(uint256[6] newWeights)`
Updates scoring weights.

**Parameters:**
- `newWeights` (uint256[6]): New weights (must sum to 10000)

**Requirements:**
- Caller must have MANAGER_ROLE
- Weights must sum to 10000

#### `updateSettings(uint256 newMinValidatorCount, uint256 newBaseRewardRate, uint256 newBonusMultiplier)`
Updates contract settings.

**Parameters:**
- `newMinValidatorCount` (uint256): Minimum validators required
- `newBaseRewardRate` (uint256): Base reward rate
- `newBonusMultiplier` (uint256): Bonus multiplier for top performers

## MetaTransactionPaymaster

### Meta Transactions

#### `executeMetaTransaction(address user, bytes signature, MetaTransaction metaTx)` → bytes
Executes a gasless transaction.

**Parameters:**
- `user` (address): User who initiated the transaction
- `signature` (bytes): User's signature
- `metaTx` (MetaTransaction): Transaction data

**Returns:**
- `result` (bytes): Result of the transaction call

**Requirements:**
- Paymaster not paused
- User not blacklisted
- Rate limits not exceeded
- Valid signature
- Valid nonce

### Token Management

#### `addPaymentToken(address token, uint256 gasPrice, string name, string symbol)`
Adds a new payment token.

**Parameters:**
- `token` (address): Token contract address
- `gasPrice` (uint256): Gas price for this token
- `name` (string): Token name
- `symbol` (string): Token symbol

**Requirements:**
- Caller must have MANAGER_ROLE

#### `updatePaymentToken(address token, uint256 gasPrice, bool isActive)`
Updates payment token configuration.

**Parameters:**
- `token` (address): Token to update
- `gasPrice` (uint256): New gas price
- `isActive` (bool): Active status

**Requirements:**
- Caller must have MANAGER_ROLE

### User Management

#### `setWhitelist(address user, bool isWhitelisted, uint256 monthlyQuota)`
Sets user whitelist status.

**Parameters:**
- `user` (address): User to update
- `isWhitelisted` (bool): Whitelist status
- `monthlyQuota` (uint256): Monthly quota for gas sponsorship

**Requirements:**
- Caller must have MANAGER_ROLE

#### `setBlacklist(address user, bool isBlacklisted)`
Sets user blacklist status.

**Parameters:**
- `user` (address): User to update
- `isBlacklisted` (bool): Blacklist status

**Requirements:**
- Caller must have MANAGER_ROLE

### Rate Limiting

#### `updateRateLimits(uint256 maxTransactionsPerDay, uint256 maxGasPerDay, uint256 cooldownPeriod)`
Updates rate limiting parameters.

**Parameters:**
- `maxTransactionsPerDay` (uint256): Maximum transactions per day
- `maxGasPerDay` (uint256): Maximum gas per day
- `cooldownPeriod` (uint256): Minimum time between transactions

**Requirements:**
- Caller must have MANAGER_ROLE

### Emergency Controls

#### `setPaused(bool pause)`
Pauses or unpauses the contract.

**Parameters:**
- `pause` (bool): Pause status

**Requirements:**
- Caller must have PAUSER_ROLE

## SylOSGovernance

### Proposals

#### `propose(address[] targets, uint256[] values, bytes[] calldatas, string title, string description, string evidence)` → uint256
Creates a new governance proposal.

**Parameters:**
- `targets` (address[]): Target contracts to call
- `values` (uint256[]): ETH values for each target
- `calldatas` (bytes[]): Function call data
- `title` (string): Proposal title
- `description` (string): Proposal description
- `evidence` (string): IPFS hash of proposal evidence

**Returns:**
- `proposalId` (uint256): ID of the created proposal

**Requirements:**
- Caller must have sufficient voting power
- Arrays must have matching lengths
- User must have sufficient locked funds

#### `vote(uint256 proposalId, uint8 support, string reason)`
Votes on a proposal.

**Parameters:**
- `proposalId` (uint256): Proposal to vote on
- `support` (uint8): Vote type (0=abstain, 1=against, 2=for)
- `reason` (string): Optional reason for the vote

**Requirements:**
- Proposal must be active
- User must not have voted before
- User must have voting power

#### `execute(uint256 proposalId)`
Executes a successful proposal.

**Parameters:**
- `proposalId` (uint256): Proposal to execute

**Requirements:**
- Voting period must be over
- Proposal must be successful
- Quorum must be reached
- Execution delay must be met

### Delegation

#### `delegate(address delegatee)`
Delegates voting power to another address.

**Parameters:**
- `delegatee` (address): Address to delegate to

**Requirements:**
- Cannot delegate to self
- Cannot delegate to zero address

#### `undelegate()`
Removes current delegation.

**Requirements:**
- Must have active delegation
- Cannot undelegate while actively delegating (7-day delay)

### Fund Management

#### `lockFunds(uint256 amount)`
Locks funds for governance participation.

**Parameters:**
- `amount` (uint256): Amount to lock

**Requirements:**
- Must have sufficient balance
- Must approve transfer to governance contract

#### `unlockFunds(uint256 amount)`
Unlocks previously locked funds.

**Parameters:**
- `amount` (uint256): Amount to unlock

**Requirements:**
- Must have sufficient locked funds
- 7-day delay after last delegation activity

### Governance Management

#### `addGovernor(address governor)`
Adds a new governor.

**Parameters:**
- `governor` (address): Address to add as governor

**Requirements:**
- Caller must have DEFAULT_ADMIN_ROLE

#### `removeGovernor(address governor)`
Removes a governor.

**Parameters:**
- `governor` (address): Address to remove

**Requirements:**
- Caller must have DEFAULT_ADMIN_ROLE

#### `emergencyAction(address target, bytes data, string reason)`
Executes an emergency action.

**Parameters:**
- `target` (address): Contract to call
- `data` (bytes): Function call data
- `reason` (string): Reason for emergency action

**Requirements:**
- Caller must have EMERGENCY_ROLE
- Must have sufficient voting power for emergency threshold

### Configuration

#### `updateSettings(uint256 newVotingDelay, uint256 newVotingPeriod, uint256 newProposalThreshold, uint256 newQuorumThreshold, uint256 newEmergencyThreshold)`
Updates governance parameters.

**Parameters:**
- `newVotingDelay` (uint256): New voting delay in blocks
- `newVotingPeriod` (uint256): New voting period in blocks
- `newProposalThreshold` (uint256): New proposal threshold
- `newQuorumThreshold` (uint256): New quorum threshold
- `newEmergencyThreshold` (uint256): New emergency threshold

**Requirements:**
- Caller must have GOVERNOR_ROLE

## Data Structures

### ProductivityMetrics
```solidity
struct ProductivityMetrics {
    uint256 taskCompletion;    // 0-1000 (0-100%)
    uint256 codeQuality;       // 0-1000 (0-100%)
    uint256 collaborationScore; // 0-1000 (0-100%)
    uint256 innovationIndex;    // 0-1000 (0-100%)
    uint256 impactScore;        // 0-1000 (0-100%)
    uint256 timeEfficiency;     // 0-1000 (0-100%)
}
```

### UserProfile
```solidity
struct UserProfile {
    uint256 totalTasks;
    uint256 completedTasks;
    uint256 totalScore;
    uint256 averageScore;
    uint256 lastUpdateTime;
    uint256 consecutiveDaysActive;
    bool isActive;
}
```

### MetaTransaction
```solidity
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
```

### GovernanceSettings
```solidity
struct GovernanceSettings {
    uint256 votingDelay;
    uint256 votingPeriod;
    uint256 proposalThreshold;
    uint256 quorumThreshold;
    uint256 emergencyThreshold;
    uint256 minExecutionDelay;
}
```

## Events

All contracts emit comprehensive events for monitoring:

- `Transfer` (ERC20 standard)
- `Approval` (ERC20 standard)
- `RoleGranted` (AccessControl)
- `RoleRevoked` (AccessControl)
- `Paused` / `Unpaused` (Pausable)

### Contract-Specific Events

#### SylOSToken
- `TaxCollected(address indexed from, address indexed to, uint256 amount, uint256 tax)`
- `TaxRateUpdated(uint256 oldRate, uint256 newRate)`
- `TaxWalletUpdated(address indexed oldWallet, address indexed newWallet)`

#### WrappedSYLOS
- `Wrapped(address indexed user, uint256 amount)`
- `Unwrapped(address indexed user, uint256 amount)`
- `RewardsClaimed(address indexed user, uint256 amount)`
- `TimeLocked(address indexed user, uint256 amount, uint256 lockDuration, uint256 endTime)`

#### PoPTracker
- `TaskCreated(uint256 indexed taskId, address indexed creator, string description, uint256 complexity)`
- `TaskCompleted(uint256 indexed taskId, address indexed user, uint256 qualityScore)`
- `ProductivityRecorded(address indexed user, uint256 totalScore, string evidenceHash)`
- `RecordVerified(address indexed user, address indexed verifier, uint256 recordId)`

#### MetaTransactionPaymaster
- `MetaTransactionExecuted(address indexed from, address indexed to, bytes32 txHash, uint256 gasUsed, address paymentToken, uint256 paymentAmount)`
- `UserWhitelisted(address indexed user, bool status)`
- `PaymentTokenAdded(address indexed token, uint256 gasPrice, string name, string symbol)`

#### SylOSGovernance
- `ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title, string description, address[] targets, uint256[] values, string evidence)`
- `Voted(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 weight, string reason)`
- `ProposalExecuted(uint256 indexed proposalId)`
- `DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate)`

## Security Considerations

### Access Control
- All admin functions use role-based access control
- Multiple signatures required for critical operations
- Emergency pause functionality on all contracts

### Reentrancy Protection
- All state-changing functions use ReentrancyGuard
- Follows Checks-Effects-Interactions pattern
- No external calls before state updates

### Input Validation
- Comprehensive input validation on all external functions
- Range checks on numeric parameters
- Address validation for critical parameters

### Gas Optimization
- Optimized for gas efficiency
- Batched operations where possible
- Storage packing for complex data structures

### Emergency Recovery
- Token recovery functions for accidentally sent tokens
- ETH recovery for gas refunds
- Pausable functionality for emergency stops

This API reference covers all public and external functions in the SylOS smart contract ecosystem. For implementation details and internal functions, refer to the source code comments.