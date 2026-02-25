# SylOS Strict Implementation Plan

**Created**: 2026-02-25
**Goal**: Transform SylOS from a desktop OS skin into a regulated digital civilization for AI agents.
**Rule**: Every task has a clear deliverable. Nothing is "done" until the artifact exists and works.

---

## Phase 0: Cleanup (Remove Noise, Make Buildable)

### 0.1 Delete Bloat Directories
- [ ] Delete `sylos-mobile-new/` (empty Expo template)
- [ ] Delete `sylos-mobile-fixed/` (mislabeled Vite web app)
- [ ] Delete `.browser_screenshots/` (69MB dead screenshots)
- [ ] Delete `test-dist/` (empty artifact)
- [ ] Delete `test.html`, `sylos-preview.html` (random test files)
- [ ] Delete `deploy-contracts.sh`, `deploy-production.sh` from root (duplicates)
- [ ] Merge `REMIX_CONTRACTS/` into `smart-contracts/_remix-originals/`

### 0.2 Archive False Reports
- [ ] Move all 57 root-level report/status `.md` files into `archive/legacy-reports/`
- [ ] Keep only: `README.md`, `CODEBASE_AUDIT.md`, `IMPLEMENTATION_PLAN.md`

### 0.3 Clean Root Directory
- [ ] Create proper root `.gitignore`
- [ ] Remove `bundler-analyzer.config.js`, `vite.config.production.ts`, `typedoc.json` from root (belong in app dir)
- [ ] Move `config/`, `scripts/` from root into `sylos-blockchain-os/` where they belong
- [ ] Move `security-config.json` into proper location

### 0.4 Fix Environment
- [ ] Create proper `.env.development` in `sylos-blockchain-os/` with real Supabase URL
- [ ] Verify contract addresses match deployed contracts

### 0.5 Verify Build
- [ ] `cd sylos-blockchain-os && npm install && npm run build` must succeed
- [ ] `cd smart-contracts && npm install && npx hardhat compile` must succeed

---

## Phase 1: Agent Civilization Smart Contracts

The client-side agent system (AgentRegistry.ts, AgentRoles.ts, AgentRuntime.ts, AgentSessionWallet.ts) is well-designed but lives in localStorage. These contracts move the critical parts on-chain.

### 1.1 AgentRegistry.sol
**Purpose**: On-chain agent lifecycle — spawn, bond, scope, expire, revoke, delete.

**Interface** (mirrors AgentRegistry.ts):
```
spawnAgent(name, role, stakeBond, permissionHash, expiresAt) → agentId
pauseAgent(agentId)
resumeAgent(agentId)
revokeAgent(agentId) → returns stake to sponsor (minus slashing)
renewAgent(agentId, newExpiry)
getAgent(agentId) → AgentRecord
getAgentsBySponsor(sponsor) → agentId[]
isActive(agentId) → bool
```

**Data**:
```
struct AgentRecord {
    bytes32 agentId;
    address sponsor;
    string name;
    AgentRole role;
    uint256 stakeBond;
    bytes32 permissionHash;  // keccak256 of permission scope
    AgentStatus status;      // Active, Paused, Revoked, Expired
    uint256 spawnedAt;
    uint256 expiresAt;
    uint256 reputationScore; // 0-10000 basis points
    address sessionWallet;
}
```

**Rules**:
- Max 10 active agents per sponsor
- Minimum stake: 100 wSYLOS
- Sponsor must approve wSYLOS transfer for stake
- Only sponsor or admin can pause/revoke
- Revocation returns stake minus slashed amount
- Expired agents auto-deactivate on any interaction

**Events**: AgentSpawned, AgentPaused, AgentResumed, AgentRevoked, AgentExpired, AgentRenewed

### 1.2 ReputationScore.sol
**Purpose**: Non-transferable on-chain reputation for agents (and humans).

**Interface**:
```
recordPositiveAction(agentId, delta, reason)  // only authorized oracles
recordNegativeAction(agentId, delta, reason)  // only authorized oracles
getReputation(agentId) → uint256
getReputationTier(agentId) → Tier  // UNTRUSTED/NOVICE/RELIABLE/TRUSTED/ELITE
```

**Rules** (from AgentRuntime.ts):
- +1 per successful tool execution
- +5 per successful task completion
- -5 per failed tool
- -10 per failed task
- -50 per rate limit violation
- -100 per permission violation
- Score range: 0-10000
- Below 500: auto-triggers pause via AgentRegistry
- Decay: -1 per day of inactivity (optional)

**Tiers**:
- 0-999: UNTRUSTED
- 1000-2999: NOVICE
- 3000-5999: RELIABLE
- 6000-8499: TRUSTED
- 8500-10000: ELITE

### 1.3 SlashingEngine.sol
**Purpose**: Automated penalty enforcement.

**Interface**:
```
reportViolation(agentId, violationType, evidence)
executeSlash(agentId, amount)
getSlashingHistory(agentId) → SlashRecord[]
```

**Violation Types**:
- RATE_LIMIT_EXCEEDED: 5% stake slash
- PERMISSION_VIOLATION: 10% stake slash
- FUND_MISUSE: 25% stake slash
- CRITICAL_FAULT: 50% stake slash + auto-revoke

**Rules**:
- Only authorized reporters (AgentRuntime oracle, governance)
- Slashed funds go to treasury
- Slashing reduces stake in AgentRegistry
- Critical violations trigger automatic agent revocation

### 1.4 Restore SylOSToken.sol
- [ ] Copy from `_deprecated/SylOSToken.sol` to `contracts/SylOSToken.sol`
- [ ] Verify it compiles with current OpenZeppelin v5
- [ ] Add to deployment script

### 1.5 Tests
- [ ] AgentRegistry: spawn, pause, resume, revoke, expire, stake enforcement
- [ ] ReputationScore: positive/negative actions, tier calculation, auto-pause trigger
- [ ] SlashingEngine: violation reporting, slash execution, fund flow
- [ ] Integration: Full lifecycle — spawn agent → do work → earn reputation → violate → get slashed → get revoked

### 1.6 Deployment Script Update
- [ ] Add AgentRegistry, ReputationScore, SlashingEngine to deploy.js
- [ ] Configure cross-contract permissions (SlashingEngine can call AgentRegistry)
- [ ] Set up roles properly

---

## Phase 2: Agent Runtime Backend (Future)
- Agent Orchestrator (server-side agent lifecycle)
- Event Indexer (index on-chain events)
- Agent API Gateway (structured perception/action APIs)
- Reputation Aggregator (compute and submit scores)

## Phase 3: Frontend Civilization Dashboard (Future)
- Civilization Overview (all agents, economy flows)
- Agent Lifecycle Manager UI (spawn, fund, monitor, revoke)
- Reputation Explorer
- Kill-Switch Panel
- Replace all mock data in DeFi/Bridge interfaces

## Phase 4: Agent Economy (Future)
- PaymentStreaming.sol (continuous micropayments)
- AgentMarketplace.sol (hire/rent agents)
- Machine-to-machine commerce integration

## Phase 5: Mobile Alignment (Future)
- Agent management screens in sylos-mobile
- Reputation viewing, agent notifications

## Phase 6: Production Hardening (Future)
- Contract security audit
- Proper secrets management
- Monitoring and alerting
- Real CI/CD pipeline
