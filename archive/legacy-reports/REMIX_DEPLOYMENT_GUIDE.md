# 🎯 SylOS Smart Contracts Deployment Guide for Remix

## Overview
Deploy 5 smart contracts to Polygon network using Remix IDE, in specific order due to dependencies.

## Network Configuration
- **Network**: Polygon (MATIC) Mainnet
- **Chain ID**: 137
- **RPC**: https://polygon-rpc.com/ or https://polygon.llamarpc.com/
- **Currency**: MATIC
- **Block Explorer**: https://polygonscan.com/

## Contract Deployment Order

### 1. SylOSToken.sol
**File**: Copy from `/workspace/smart-contracts/contracts/SylOSToken.sol`

**Constructor Parameters**:
```
1. string name: "SylOSToken"
2. string symbol: "SYLOS"  
3. uint256 initialSupply: 1000
4. address admin: [YOUR_ADMIN_ADDRESS]
5. address taxWallet: [YOUR_TAX_WALLET]
6. address liquidityWallet: [YOUR_LIQUIDITY_WALLET]
```

**Features**:
- ERC-20 with minting/burning
- 2.5% transaction tax
- Role-based access control
- Anti-bot protection

### 2. WrappedSYLOS.sol
**File**: Copy from `/workspace/smart-contracts/contracts/WrappedSYLOS.sol`

**Constructor Parameters**:
```
1. address underlyingToken: [SYLOSTOKEN_ADDRESS_FROM_STEP_1]
2. string name: "Wrapped SylOS Token"
3. string symbol: "wSYLOS"
```

**Features**:
- 1:1 wrapped SYLOS
- Staking rewards system
- Time-based bonuses
- Burnable for PoP rewards

### 3. PoPTracker.sol
**File**: Copy from `/workspace/smart-contracts/contracts/PoPTracker.sol`

**Constructor Parameters**:
```
1. address rewardToken: [WRAPPEDSYLOS_ADDRESS_FROM_STEP_2]
2. address treasury: [YOUR_TREASURY_WALLET]
3. address admin: [YOUR_ADMIN_ADDRESS]
```

**Features**:
- Productivity metrics tracking
- Multi-criteria scoring (0-100%)
- Reward distribution
- Peer validation system

### 4. MetaTransactionPaymaster.sol
**File**: Copy from `/workspace/smart-contracts/contracts/MetaTransactionPaymaster.sol`

**Constructor Parameters**:
```
1. address admin: [YOUR_ADMIN_ADDRESS]
2. address treasury: [YOUR_TREASURY_WALLET]
```

**Features**:
- Gasless transactions
- ERC20 payment system
- Rate limiting
- Whitelist management

### 5. SylOSGovernance.sol
**File**: Copy from `/workspace/smart-contracts/contracts/SylOSGovernance.sol`

**Constructor Parameters**:
```
1. address token: [SYLOSTOKEN_ADDRESS_FROM_STEP_1]
2. address timelock: [YOUR_TREASURY_WALLET]
3. address votingDelay: [YOUR_TREASURY_WALLET]
4. address admin: [YOUR_ADMIN_ADDRESS]
```

**Features**:
- DAO governance system
- Proposal voting
- Quorum requirements
- Emergency controls

## Remix Setup Steps

### Step 1: Create New Workspace
1. Open https://remix.ethereum.org
2. Create new workspace "SylOS-Contracts"

### Step 2: Create Contract Files
Create 5 new files in Remix and copy the contract code:
- `1_SylOSToken.sol`
- `2_WrappedSYLOS.sol`  
- `3_PoPTracker.sol`
- `4_MetaTransactionPaymaster.sol`
- `5_SylOSGovernance.sol`

### Step 3: Configure Compiler
- **Version**: 0.8.20
- **EVM Version**: default
- **Optimization**: Enabled (200 runs)

### Step 4: Set Up Network
1. Click "Deploy" tab
2. Select "Injected Provider" (MetaMask)
3. Ensure MetaMask is connected to Polygon Mainnet
4. Fund wallet with MATIC for gas fees (~0.5 MATIC total)

### Step 5: Deploy Contracts
Deploy in exact order, waiting for each transaction to confirm before proceeding to next:

1. **Deploy SylOSToken** → Record contract address
2. **Deploy WrappedSYLOS** → Use address from step 1
3. **Deploy PoPTracker** → Use address from step 2  
4. **Deploy MetaTransactionPaymaster** → Standalone deployment
5. **Deploy SylOSGovernance** → Use address from step 1

## Post-Deployment Configuration

After all contracts are deployed, interact with them to set up the ecosystem:

### Set Up Roles
1. **SylOSToken**: Set up roles for admin, pauser, minter
2. **WrappedSYLOS**: Configure reward distribution periods
3. **PoPTracker**: Set up productivity criteria and validators
4. **MetaTransactionPaymaster**: Add SYLOS as payment token
5. **SylOSGovernance**: Set governance parameters and proposal thresholds

### Add Payment Token to Paymaster
```solidity
await metaTransactionPaymaster.addPaymentToken(
  sylosTokenAddress,
  20000000000000, // 20 gwei in token units
  "SylOSToken",
  "SYLOS"
);
```

## Gas Estimation
- **Total deployment cost**: ~0.3-0.5 MATIC (~$0.60-1.00 USD)
- **Individual contract costs**:
  - SylOSToken: ~0.08 MATIC
  - WrappedSYLOS: ~0.06 MATIC
  - PoPTracker: ~0.12 MATIC
  - MetaTransactionPaymaster: ~0.15 MATIC
  - SylOSGovernance: ~0.09 MATIC

## Contract Verification
After deployment, verify contracts on Polygonscan:
1. Go to each contract on https://polygonscan.com
2. Click "Verify and Publish"
3. Copy contract code and compiler settings
4. Submit for verification

## Important Notes
- **Keep addresses**: Save all contract addresses immediately
- **Test interactions**: Verify contract functions work correctly
- **Security audit**: Consider professional audit before mainnet use
- **Backup**: Keep deployment transaction hashes and contract codes

## Next Steps
After deployment:
1. Configure frontend with contract addresses
2. Set up monitoring and analytics
3. Create governance proposals for ecosystem parameters
4. Launch PoP tracking system
5. Enable gasless transactions through paymaster