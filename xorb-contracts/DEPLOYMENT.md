# X.orb Smart Contract Deployment Guide

## Prerequisites

- Node.js >= 18
- pnpm (or npm)
- A funded deployer wallet (ETH for gas on Base)
- USDC contract address for the target network
- Hardhat installed (`npx hardhat --version`)

## Environment Variables

Copy `.env.example` to `.env` in `xorb-contracts/` and fill in:

```bash
DEPLOYER_PRIVATE_KEY=0x...          # Deployer wallet private key (NEVER commit)
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=your_basescan_api_key
```

## USDC Addresses

| Network       | USDC Address                                 |
|---------------|----------------------------------------------|
| Base Mainnet  | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia  | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Polygon       | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` |

## Deployment Order

Contracts must be deployed in this exact order because later contracts depend on earlier ones.

### Step 1: XorbEscrow

```bash
# Constructor: XorbEscrow(address _usdc, address _treasury)
# No dependencies on other X.orb contracts.
```

### Step 2: AgentRegistry

```bash
# Constructor: AgentRegistry(address _stakeToken, address _treasury, address _admin)
# _stakeToken = USDC address
# _treasury   = your treasury wallet
# _admin      = admin wallet (receives DEFAULT_ADMIN_ROLE + OPERATOR_ROLE)
```

### Step 3: ReputationScore

```bash
# Constructor: ReputationScore(address _agentRegistry, address _admin)
# _agentRegistry = AgentRegistry address from Step 2
# _admin         = admin wallet
```

### Step 4: SlashingEngine

```bash
# Constructor: SlashingEngine(address _agentRegistry, address _reputationScore, address _admin)
# _agentRegistry   = AgentRegistry address from Step 2
# _reputationScore = ReputationScore address from Step 3
# _admin           = admin wallet
```

### Step 5: ActionVerifier

```bash
# Constructor: ActionVerifier()
# No constructor arguments. Deployer gets DEFAULT_ADMIN_ROLE + VERIFIER_ROLE.
```

### Step 6: PaymentStreaming

```bash
# Constructor: PaymentStreaming(address _token, address _treasury)
# _token    = USDC address
# _treasury = your treasury wallet
```

### Step 7: AgentMarketplace

```bash
# Constructor: AgentMarketplace(address _token, address _treasury)
# _token    = USDC address
# _treasury = your treasury wallet
```

## Post-Deployment Configuration

After all contracts are deployed, configure cross-contract permissions:

```bash
# 1. Tell AgentRegistry about ReputationScore and SlashingEngine
AgentRegistry.setReputationContract(<ReputationScore address>)
AgentRegistry.setSlashingContract(<SlashingEngine address>)

# 2. Grant SlashingEngine the ORACLE_ROLE on ReputationScore
#    so it can apply reputation penalties during slashing
ReputationScore.grantRole(ORACLE_ROLE, <SlashingEngine address>)

# 3. Grant your backend oracle service the ORACLE_ROLE on ReputationScore
ReputationScore.grantRole(ORACLE_ROLE, <backend oracle address>)

# 4. Grant your backend service the REPORTER_ROLE on SlashingEngine
SlashingEngine.grantRole(REPORTER_ROLE, <backend service address>)

# 5. Grant XorbEscrow the SLASHER_ROLE if SlashingEngine needs to slash escrows
XorbEscrow.grantRole(SLASHER_ROLE, <SlashingEngine address>)
```

## Deploy Commands

### Base Sepolia (Testnet)

```bash
cd xorb-contracts

# Compile contracts
npx hardhat compile

# Deploy all contracts
npx hardhat run scripts/deploy-base.js --network baseSepolia

# Verify each contract on BaseScan
npx hardhat verify --network baseSepolia <XorbEscrow address> <USDC_SEPOLIA> <treasury>
npx hardhat verify --network baseSepolia <AgentRegistry address> <USDC_SEPOLIA> <treasury> <admin>
npx hardhat verify --network baseSepolia <ReputationScore address> <AgentRegistry address> <admin>
npx hardhat verify --network baseSepolia <SlashingEngine address> <AgentRegistry address> <ReputationScore address> <admin>
npx hardhat verify --network baseSepolia <ActionVerifier address>
npx hardhat verify --network baseSepolia <PaymentStreaming address> <USDC_SEPOLIA> <treasury>
npx hardhat verify --network baseSepolia <AgentMarketplace address> <USDC_SEPOLIA> <treasury>
```

### Base Mainnet (Production)

```bash
cd xorb-contracts

# Compile contracts
npx hardhat compile

# Deploy all contracts
npx hardhat run scripts/deploy-base.js --network base

# Verify each contract on BaseScan
npx hardhat verify --network base <XorbEscrow address> <USDC_MAINNET> <treasury>
npx hardhat verify --network base <AgentRegistry address> <USDC_MAINNET> <treasury> <admin>
npx hardhat verify --network base <ReputationScore address> <AgentRegistry address> <admin>
npx hardhat verify --network base <SlashingEngine address> <AgentRegistry address> <ReputationScore address> <admin>
npx hardhat verify --network base <ActionVerifier address>
npx hardhat verify --network base <PaymentStreaming address> <USDC_MAINNET> <treasury>
npx hardhat verify --network base <AgentMarketplace address> <USDC_MAINNET> <treasury>
```

## Verification Notes

- The `deploy-base.js` script auto-detects the USDC address by chain ID.
- Deployment addresses are saved to `deployments/base-<chainId>-<timestamp>.json`.
- The hardhat config must include `baseSepolia` in `etherscan.apiKey` for verification to work. Currently only `polygon`, `polygonAmoy`, and `sepolia` are configured -- you may need to add:

```js
// In hardhat.config.js etherscan.apiKey:
baseSepolia: process.env.BASESCAN_API_KEY || "",
base: process.env.BASESCAN_API_KEY || "",
```

## Checklist

- [ ] `.env` populated with `DEPLOYER_PRIVATE_KEY`, RPC URLs, and `BASESCAN_API_KEY`
- [ ] Deployer wallet funded with ETH for gas
- [ ] Contracts compiled (`npx hardhat compile`)
- [ ] Deployed in order (XorbEscrow -> AgentRegistry -> ReputationScore -> SlashingEngine -> ActionVerifier -> PaymentStreaming -> AgentMarketplace)
- [ ] Cross-contract permissions configured (setReputationContract, setSlashingContract, grantRole)
- [ ] All contracts verified on BaseScan
- [ ] Deployment addresses recorded and saved to API env vars
- [ ] Treasury address is a multisig (for production)
