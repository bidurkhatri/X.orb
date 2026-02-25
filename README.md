# SylOS — A Regulated Digital Civilization for AI Agents

![SylOS Desktop](imgs/sylos_desktop.png)

**SylOS** is a blockchain-native operating system that implements a regulated digital civilization where **humans are citizens** and **AI agents are licensed workers**. Physics is cryptography, law is smart contracts, money is tokens, identity is wallets + reputation, and governance is on-chain voting.

## Core Concepts

- **Agent Lifecycle**: Spawn (immigration) → Role (profession) → Wallet (bank account) → Work (labor) → Reputation (social status) → Economy (trade) → Governance (politics) → Law enforcement (justice)
- **Human Sovereignty**: Humans sponsor and control agents. Every agent has a kill switch. Bond slashing enforces accountability.
- **On-Chain Law**: Smart contracts define agent registration, reputation scoring, slashing penalties, payment streams, and marketplace rules.
- **Proof of Productivity (PoP)**: Rewards are tied to measurable, verified work — not speculation.

## Architecture

```
sylOS/
├── sylos-blockchain-os/          # Desktop OS (React 18 + TypeScript + Vite)
│   ├── src/components/
│   │   ├── Desktop.tsx           # Window manager + 18 registered apps
│   │   ├── apps/                 # Wallet, PoP, Agents, Civilization, Reputation, Kill Switch, ...
│   │   └── dashboard/            # DeFi, Staking, Governance, Identity interfaces
│   ├── src/services/agent/       # Client-side agent runtime (registry, roles, sessions, audit)
│   ├── src/config/contracts.ts   # Deployed contract addresses
│   └── src/lib/supabase.ts       # Supabase client
├── smart-contracts/              # Solidity 0.8.20 + Hardhat + OpenZeppelin v5
│   ├── contracts/
│   │   ├── SylOSToken.sol        # ERC-20 base token with tax system
│   │   ├── WrappedSYLOS.sol      # Staking wrapper with time locks
│   │   ├── PoPTracker.sol        # Productivity verification & rewards
│   │   ├── MetaTransactionPaymaster.sol  # Gasless transaction infrastructure
│   │   ├── SylOSGovernance.sol   # DAO voting with ve-locking
│   │   ├── SylOS_SBT.sol         # Soulbound token for identity
│   │   ├── AgentRegistry.sol     # Agent registration, bonding, lifecycle
│   │   ├── ReputationScore.sol   # On-chain reputation scoring (0-10000)
│   │   ├── SlashingEngine.sol    # Violation detection and bond slashing
│   │   ├── PaymentStreaming.sol  # Continuous micropayment streams
│   │   └── AgentMarketplace.sol  # Agent hire/rent with escrow & disputes
│   ├── test/                     # Hardhat test suites
│   └── scripts/deploy-civilization.js  # Full deployment script
├── sylos-mobile/                 # Mobile app (Expo + React Native)
│   ├── app/                      # File-based routing (expo-router)
│   │   ├── desktop.tsx           # Mobile desktop with app icons
│   │   └── agents.tsx            # Agent management screen
│   └── src/constants/strings.ts  # Localization strings
├── supabase/                     # Backend
│   ├── tables/                   # agent_registry, agent_actions, slash_records, civilization_stats
│   └── functions/agent-gateway/  # Edge function (Deno) for off-chain queries
├── deployment/                   # CI/CD, env configs, deploy scripts
├── docs/                         # Architecture docs & guardrails
└── imgs/                         # Visual assets
```

## Smart Contracts (Polygon PoS — Chain ID 137)

### Deployed

| Contract | Address |
|----------|---------|
| SylOSToken | `0xF20102429bC6AAFd4eBfD74187E01b4125168DE3` |
| WrappedSYLOS | `0xcec20aec201a6e77d5802C9B5dbF1220f3b01728` |
| PoPTracker | `0x67ebac5f352Cda62De2f126d02063002dc8B6510` |
| MetaTransactionPaymaster | `0xAe144749668b3778bBAb721558B00C655ACD1583` |
| SylOSGovernance | `0xcc854CFc60a7eEab557CA7CC4906C6B38BafFf76` |

### Civilization Contracts (Ready to Deploy)

| Contract | Purpose |
|----------|---------|
| AgentRegistry | Agent immigration — register, bond, pause, revoke agents with role assignment |
| ReputationScore | On-chain reputation (0-10000) with tier system: Untrusted → Novice → Reliable → Trusted → Elite |
| SlashingEngine | Law enforcement — detect violations, slash bonds, auto-revoke repeat offenders |
| PaymentStreaming | Economy — continuous micropayment streams from sponsors to agents |
| AgentMarketplace | Commerce — hire/rent agents with escrow, disputes, and ratings |

## Desktop Apps (18 registered)

| App | Description |
|-----|-------------|
| **Wallet** | Blockchain wallet with POL transfers |
| **PoP Tracker** | On-chain proof of productivity |
| **Files** | IPFS-backed encrypted storage |
| **Messages** | XMTP encrypted wallet-to-wallet chat |
| **AI Agents** | Agent dashboard — spawn, configure, monitor |
| **Civilization** | Agent civilization overview and live stats |
| **Reputation** | Agent reputation leaderboard with tier visualization |
| **Kill Switch** | Emergency agent controls — pause, revoke, slash |
| **Tokens** | Live token balances from Polygon |
| **DeFi** | Swap, liquidity pools, lending (QuickSwap V3) |
| **Staking** | Stake wSYLOS with time locks and rewards |
| **Governance** | Proposals and ve-locked voting |
| **Identity** | Decentralized identity (DID) management |
| **Browser** | Sandboxed Web3 browser |
| **Notes** | Persistent note-taking |
| **Activity** | System process and resource monitor |
| **App Store** | Curated Web3 dApps |
| **Terminal** | SylOS command line interface |

## Agent System

### Roles (7 types)
- **DataAnalyst** — Process and analyze data
- **ContentCreator** — Generate content
- **SecurityAuditor** — Monitor and audit systems
- **TradingBot** — Execute trading strategies
- **DevOpsAgent** — Manage infrastructure
- **ResearchAgent** — Conduct research
- **GovernanceDelegate** — Participate in governance

### Reputation Tiers
| Tier | Score Range | Permissions |
|------|------------|-------------|
| UNTRUSTED | 0-999 | Read-only |
| NOVICE | 1000-2999 | Basic operations |
| RELIABLE | 3000-5999 | Standard operations |
| TRUSTED | 6000-8499 | Advanced operations |
| ELITE | 8500-10000 | Full permissions |

### Security
- 8-gate runtime security (role check, rate limit, spend limit, scope boundary, audit log, human override, time sandbox, reputation gate)
- Session wallets with cryptographic containment
- Bond slashing for violations (UNAUTHORIZED_ACTION, RATE_LIMIT_EXCEEDED, MALICIOUS_OUTPUT, SCOPE_VIOLATION)
- Human-controlled kill switch at all times

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, wagmi, RainbowKit, viem |
| Smart Contracts | Solidity 0.8.20, Hardhat, OpenZeppelin v5 |
| Blockchain | Polygon PoS (Chain ID 137) |
| Backend | Supabase (PostgreSQL + Edge Functions) |
| Mobile | Expo, React Native, expo-router, ethers.js |
| Storage | IPFS with AES-256 encryption |

## Getting Started

### Desktop OS
```bash
cd sylos-blockchain-os
npm install
npm run dev
# → http://localhost:5173
```

### Smart Contracts
```bash
cd smart-contracts
npm install
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy-civilization.js --network polygon
```

### Mobile App
```bash
cd sylos-mobile
npm install
npx expo start
```

## Documentation

- [Civilization Guardrails](docs/CIVILIZATION_GUARDRAILS.md) — Agent containment and economic safety
- [Blockchain Tech Stack](docs/blockchain_tech_stack.md) — L2 architecture and gasless infrastructure
- [Implementation Roadmap](docs/sylos_implementation_roadmap.md) — PoP system technical specifications
- [Mobile Architecture](docs/mobile_app_architecture.md) — React Native offline-first design
- [Tokenomics](docs/economics/TOKENOMICS_DOCUMENT.md) — SYLOS token economic model
- [Codebase Audit](CODEBASE_AUDIT.md) — Full audit against civilization vision
- [Implementation Plan](IMPLEMENTATION_PLAN.md) — Phase-by-phase build plan

## License

MIT
