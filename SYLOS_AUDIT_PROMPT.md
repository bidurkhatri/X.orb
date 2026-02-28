# SylOS — Comprehensive Audit, Fix & Validation Prompt

**Purpose:** Use this prompt with an AI coding agent (Claude, Cursor, etc.) to perform a deep, practical audit of the entire SylOS codebase. Every section below must be executed hands-on — run commands, read files, verify outputs, and fix what's broken.

---

## INSTRUCTIONS FOR THE AUDITOR

You are auditing **SylOS**, a blockchain-native operating system where AI agents live, work, and earn — governed by blockchain law. The project is a monorepo with 5 major subsystems:

| Subsystem | Path | Tech |
|-----------|------|------|
| Desktop OS | `sylos-blockchain-os/` | React 18 + TypeScript + Vite |
| Smart Contracts | `smart-contracts/` | Solidity 0.8.20 + Hardhat |
| Mobile App | `sylos-mobile/` | React Native + Expo 51 |
| Backend | `supabase/` | PostgreSQL + Deno Edge Functions |
| Shared Types | `packages/shared-types/` | TypeScript |

**Rules:**
1. **Be practical** — run every command, don't assume anything works
2. **Fix what you find** — don't just report, actually repair broken code
3. **Verify after fixing** — re-run the command to confirm the fix works
4. **Track everything** — use a todo list to track progress through each section
5. **Don't skip sections** — even if something looks fine, verify it

---

## PHASE 1: ENVIRONMENT & BUILD HEALTH

### 1.1 — Dependency Installation

```
# Run each and report success/failure with exact errors:
cd sylos-blockchain-os && pnpm install
cd smart-contracts && npm install
cd sylos-mobile && npm install
cd packages/shared-types && pnpm install
```

**Check for:**
- [ ] Peer dependency warnings — are any critical?
- [ ] Deprecated packages — list them
- [ ] Security vulnerabilities — run `npm audit` / `pnpm audit` in each package
- [ ] Lock file consistency — does the lock file match package.json?
- [ ] Node version requirements — check `.nvmrc` or `engines` field

**Fix:** Resolve any blocking install errors. Document non-blocking warnings.

### 1.2 — Build Verification

```
# Each must exit 0:
cd sylos-blockchain-os && pnpm run build
cd smart-contracts && npx hardhat compile
cd sylos-mobile && npx expo export --platform web  # or just type-check
```

**Check for:**
- [ ] TypeScript compilation errors — fix ALL of them
- [ ] Unused imports and dead code warnings
- [ ] Solidity compiler warnings (unused variables, shadowing, etc.)
- [ ] Build output size — is it reasonable? (check `dist/` sizes)
- [ ] Source maps — are they generated for debugging?

**Fix:** Every build must succeed cleanly. Zero errors. Warnings should be minimized.

### 1.3 — Environment Variables

```
# Check all .env files and .env.example files:
find . -name ".env*" -not -path "*/node_modules/*"
```

**Check for:**
- [ ] Are `.env.example` files present for every package that needs env vars?
- [ ] Do example files have descriptive placeholder values (not real keys)?
- [ ] Are any real secrets committed to git? (`git log --all -p -- "*.env"`)
- [ ] Does `sylos-blockchain-os/.env.example` list ALL required `VITE_*` vars?
- [ ] Does `smart-contracts/.env.example` list ALL required vars (RPC, keys)?
- [ ] Are deployed contract addresses correct and up-to-date?
- [ ] Is `VITE_ENABLE_MOCK_DATA` documented — what does it control?

**Fix:** Create missing `.env.example` files. Remove any committed secrets. Add comments explaining each variable.

### 1.4 — Git Repository Health

```
git status
git log --oneline -20
cat .gitignore
```

**Check for:**
- [ ] Are `node_modules/`, `.env`, `dist/`, build artifacts in `.gitignore`?
- [ ] Are there any large binary files tracked? (`git rev-list --objects --all | git cat-file --batch-check | sort -k3 -n | tail -20`)
- [ ] Are there abandoned/duplicate directories that should be deleted?
- [ ] Is the commit history clean or full of "fix" / "test" / "wip" commits?
- [ ] Are there any untracked files that should be committed or ignored?

**Fix:** Update `.gitignore`. Remove tracked files that shouldn't be. Clean up bloat directories.

---

## PHASE 2: SMART CONTRACT AUDIT

### 2.1 — Contract Inventory

```
ls smart-contracts/contracts/*.sol
```

**Verify ALL these contracts exist and compile:**

| Contract | Purpose | Must Exist |
|----------|---------|------------|
| `SylOSToken.sol` | ERC-20 SYLOS token with transfer tax | YES |
| `WrappedSYLOS.sol` | Wrap/unwrap + staking rewards + time-lock | YES |
| `AgentRegistry.sol` | Agent spawn, bond, pause, revoke, expire | YES |
| `ReputationScore.sol` | Non-transferable reputation, tier system | YES |
| `SlashingEngine.sol` | Automated penalty enforcement | YES |
| `SylOSGovernance.sol` | Dual-layer voting (human vs AI) | YES |
| `SylOS_SBT.sol` | Soulbound identity tokens | YES |
| `AgentMarketplace.sol` | Agent hiring/rental marketplace | YES |
| `PaymentStreaming.sol` | Per-second salary streaming | YES |
| `MetaTransactionPaymaster.sol` | Gasless transactions, EIP-712 | YES |
| `PoPTracker.sol` | Proof of Productivity + Chainlink oracle | YES |

**Check for:**
- [ ] Missing contracts — is `SylOSToken.sol` in `contracts/` or only in `_deprecated/`?
- [ ] OpenZeppelin version compatibility — are all imports resolving?
- [ ] Compiler version consistency — all contracts using same Solidity version?

### 2.2 — Contract Logic Audit

For EACH contract, verify:

**Access Control:**
- [ ] Are admin/owner functions protected with `onlyOwner` or role-based access?
- [ ] Can the owner rug-pull? (withdraw all funds, pause forever, etc.)
- [ ] Are there proper role separations? (admin vs oracle vs reporter)
- [ ] Can agents call functions they shouldn't?

**Economic Logic:**
- [ ] `SylOSToken.sol`: Is the 2.5% transfer tax correctly implemented? Does it exclude staking/governance?
- [ ] `WrappedSYLOS.sol`: Is wrap/unwrap 1:1? Can time-lock bonuses be exploited?
- [ ] `AgentRegistry.sol`: Is the 100 wSYLOS minimum stake enforced? Max 10 agents per sponsor?
- [ ] `SlashingEngine.sol`: Are slash percentages correct (5%, 10%, 25%, 50%)? Do slashed funds go to treasury?
- [ ] `PaymentStreaming.sol`: Can a stream be drained faster than intended? Are cancellations safe?
- [ ] `AgentMarketplace.sol`: Is the 2.5% marketplace fee correct? Can an agent be hired twice?

**Reputation Logic:**
- [ ] Score range enforced: 0–10000?
- [ ] Tier boundaries correct: Untrusted(0-999), Novice(1000-2999), Reliable(3000-5999), Trusted(6000-8499), Elite(8500-10000)?
- [ ] Auto-pause below 500 triggers correctly?
- [ ] Only authorized oracles can modify scores?
- [ ] Reputation is non-transferable (soulbound)?

**Reentrancy & Safety:**
- [ ] Are external calls (token transfers) protected with ReentrancyGuard?
- [ ] Are state changes made BEFORE external calls (checks-effects-interactions)?
- [ ] Are there any unbounded loops that could cause gas limit issues?
- [ ] Integer overflow/underflow — using SafeMath or Solidity 0.8+?
- [ ] Are there proper `require()` / `revert()` messages for all failure paths?

**Events & Indexing:**
- [ ] Does every state change emit an event?
- [ ] Are event parameters indexed for efficient querying?
- [ ] Do events contain enough information to reconstruct state off-chain?

### 2.3 — Contract Tests

```
cd smart-contracts && npx hardhat test
```

**Check for:**
- [ ] Do ALL tests pass?
- [ ] What is the test coverage? (`npx hardhat coverage`)
- [ ] Are there tests for edge cases? (zero amounts, max values, expired agents, etc.)
- [ ] Are there tests for access control? (unauthorized callers should revert)
- [ ] Are there integration tests? (multi-contract flows)
- [ ] Is the full agent lifecycle tested? (spawn → work → earn reputation → violate → slash → revoke)

**Fix:** Write missing tests. Fix failing tests. Aim for >80% line coverage on all contracts.

### 2.4 — Deployment Verification

```
cat smart-contracts/scripts/deploy.js
cat smart-contracts/scripts/deploy-civilization.js
cat smart-contracts/hardhat.config.js
```

**Check for:**
- [ ] Does deploy script deploy ALL contracts in correct order?
- [ ] Are cross-contract permissions set up? (SlashingEngine authorized in AgentRegistry, etc.)
- [ ] Are constructor arguments correct?
- [ ] Do deployed addresses in `config/contracts.ts` match actual deployments?
- [ ] Can you verify contracts on Polygonscan with the source code?
- [ ] Is there a deployment log / record of what's deployed where?

**Verify on-chain (if addresses are available):**
```
# Check if contracts exist at claimed addresses:
cast code 0xF20102429bC6AAFd4eBfD74187E01b4125168DE3 --rpc-url https://polygon-rpc.com
cast code 0xcec20aec201a6e77d5802C9B5dbF1220f3b01728 --rpc-url https://polygon-rpc.com
# etc. for each deployed address
```

---

## PHASE 3: FRONTEND APPLICATION AUDIT (sylos-blockchain-os)

### 3.1 — Application Structure

```
ls -la sylos-blockchain-os/src/components/apps/
wc -l sylos-blockchain-os/src/components/apps/*.tsx
```

**Check that ALL 20 apps exist and are properly integrated:**

| App | File | Must Be Functional |
|-----|------|--------------------|
| Agent Dashboard | `AgentDashboardApp.tsx` | Core — agent spawn, monitor, control |
| Agent Community | `AgentCommunityApp.tsx` | Agent forum/social feed |
| Agent Marketplace | `AgentMarketplaceApp.tsx` | Hire/rent agents |
| Citizen Profile | `CitizenProfileApp.tsx` | Full agent identity view |
| Hire Humans | `HireHumansApp.tsx` | Reverse job board |
| Wallet | `WalletApp.tsx` | Token balances, send/receive |
| Transaction Queue | `TransactionQueueApp.tsx` | Pending approvals |
| Reputation Explorer | `ReputationExplorer.tsx` | Leaderboard + history |
| Token Dashboard | `TokenDashboardApp.tsx` | Multi-token analytics |
| PoP Tracker | `PoPTrackerApp.tsx` | Proof of Productivity |
| Settings | `SettingsApp.tsx` | Theme, providers, preferences |
| Activity Monitor | `ActivityMonitorApp.tsx` | System activity logs |
| App Store | `AppStoreApp.tsx` | Install/uninstall apps |
| File Manager | `FileManagerApp.tsx` | Supabase + IPFS files |
| Notes | `NotesApp.tsx` | Local notepad |
| Messages | `MessagesApp.tsx` | XMTP encrypted messaging |
| Kill Switch Panel | `KillSwitchPanel.tsx` | Emergency agent control |
| Civilization Dashboard | `CivilizationDashboard.tsx` | Global civilization stats |
| DApp Container | `DAppContainer.tsx` | External dApp loader |
| Web Browser | `WebBrowserApp.tsx` | Multi-tab iframe browser |

### 3.2 — Mock vs Real Data Audit

This is CRITICAL. The previous audit found many features were stubs or mocks.

**For EACH app component, search for:**
```
grep -n "mock\|Mock\|MOCK\|hardcoded\|hardcode\|placeholder\|TODO\|FIXME\|HACK\|fake\|Fake\|FAKE\|stub\|Stub\|STUB\|dummy\|sample" sylos-blockchain-os/src/components/apps/*.tsx
```

**Check specifically:**
- [ ] `DeFiInterface.tsx` — Is swap logic real or just UI? Are pool data hardcoded?
- [ ] `StakingInterface.tsx` — Do write calls actually go on-chain?
- [ ] `GovernanceInterface.tsx` — Are proposals from chain or mock arrays?
- [ ] `AgentDashboardApp.tsx` — Does agent spawning write to chain or just localStorage?
- [ ] `AgentMarketplaceApp.tsx` — Are marketplace listings from contract or hardcoded?
- [ ] `CivilizationDashboard.tsx` — Are stats computed from real data or fabricated?
- [ ] `ReputationExplorer.tsx` — Are scores from ReputationScore contract or local state?

**For each mock found:**
- [ ] Document: what is mocked, what should be real
- [ ] Classify: is this acceptable (dev mode) or broken (production claim)?
- [ ] Fix: either connect to real data source or clearly mark as "Demo Mode" in UI

### 3.3 — Agent System Services

These are the heart of SylOS. Audit each thoroughly:

**`services/agent/AgentRegistry.ts`:**
- [ ] Does `spawnAgent()` call the on-chain AgentRegistry contract?
- [ ] Or does it only write to localStorage/Supabase?
- [ ] Is the agent data model consistent with the smart contract struct?
- [ ] Are all lifecycle methods implemented? (spawn, pause, resume, revoke, expire)

**`services/agent/AgentRuntime.ts`:**
- [ ] Does the 30-second autonomy loop actually work?
- [ ] Are LLM providers (OpenAI, Groq, OpenRouter, Ollama) correctly integrated?
- [ ] Is rate limiting enforced per role? (Trading: 60/hr, Research: 120/hr, etc.)
- [ ] Are the 8 security gates implemented and functional?
- [ ] Is reputation updated after each action?
- [ ] Is audit logging complete and tamper-evident?

**`services/agent/AgentAutonomyEngine.ts`:**
- [ ] Does it correctly implement perceive → decide → execute → record?
- [ ] Are agents properly staggered (not all waking at once)?
- [ ] Does start/stop/pause/resume work gracefully?
- [ ] Error handling — what happens when an LLM call fails?

**`services/agent/AgentRoles.ts`:**
- [ ] Are all 7 roles defined with correct permissions?
- [ ] Trading: market data, transaction proposals, token prices
- [ ] Research: chain queries, file search, market data (READ-ONLY)
- [ ] Monitor: chain queries, alert system, market data
- [ ] Coder: file read/write, search, system info
- [ ] Governance: proposal read/draft, vote, chain queries
- [ ] File Indexer: file read/write, search, metadata
- [ ] Risk Auditor: audit logs, chain queries, alert system
- [ ] Are role restrictions actually ENFORCED (not just defined)?

**`services/agent/AgentSessionWallet.ts`:**
- [ ] Are session wallets derived deterministically from sponsor wallet?
- [ ] Are spending caps enforced on-chain or just client-side?
- [ ] Can a malicious agent bypass the spending cap?

**`services/agent/CitizenIdentity.ts`:**
- [ ] Is the full citizen profile populated? (birth cert, KYC, criminal record, employment, financial, lifestyle)
- [ ] Is progressive KYC verification implemented?
- [ ] Is the criminal record updated on violations?

**`services/agent/AgentAuditLogService.ts`:**
- [ ] Where are logs stored? (localStorage? Supabase? IPFS?)
- [ ] Are logs tamper-proof? (hashed, chained, or on-chain?)
- [ ] Can logs be queried efficiently?

**`services/agent/AgentSupervisor.ts`:**
- [ ] Does it monitor agent health and behavior?
- [ ] Does it trigger kill switch on critical violations?
- [ ] Is it connected to the SlashingEngine?

**`services/agent/IpcBridge.ts`:**
- [ ] Does inter-process communication between agents work?
- [ ] Is message passing secure? (can agents impersonate each other?)
- [ ] Are there proper serialization/deserialization checks?

### 3.4 — Web3 Integration

**`config/contracts.ts` and `config/abis.ts`:**
- [ ] Are ALL contract addresses present and correct?
- [ ] Are ABIs up-to-date with the compiled contracts?
- [ ] Are there separate addresses for mainnet vs testnet?
- [ ] Check ABI hash: `keccak256(abi_from_config)` vs `keccak256(abi_from_artifacts)`

**`hooks/useAgentContracts.ts`:**
- [ ] Does it use wagmi/viem correctly?
- [ ] Are read calls using `useContractRead`?
- [ ] Are write calls using `useContractWrite` with proper error handling?
- [ ] Is gas estimation handled?
- [ ] Are transaction confirmations awaited?

**`components/Web3Provider.tsx`:**
- [ ] Is RainbowKit configured with correct chains?
- [ ] Are wallet options appropriate? (MetaMask, WalletConnect, etc.)
- [ ] Is chain switching handled?
- [ ] Is the provider tree correct? (WagmiConfig → RainbowKit → QueryClient → App)

### 3.5 — UI/UX Consistency

- [ ] Does the desktop metaphor work? (windows open, drag, resize, minimize, close)
- [ ] Does the taskbar show correct agent status?
- [ ] Are notifications functional?
- [ ] Does the lock screen authenticate via wallet?
- [ ] Are error boundaries catching crashes gracefully?
- [ ] Is the app responsive / usable at different viewport sizes?
- [ ] Are loading states shown during async operations?
- [ ] Are error states shown when operations fail?

### 3.6 — Frontend Tests

```
cd sylos-blockchain-os && pnpm run test
```

- [ ] Do all tests pass?
- [ ] What is the coverage?
- [ ] Are agent services tested?
- [ ] Are contract interactions tested (with mocked providers)?
- [ ] Are UI components tested?

**Fix:** Write tests for untested critical paths. Fix failing tests.

---

## PHASE 4: MOBILE APP AUDIT (sylos-mobile)

### 4.1 — Build Verification

```
cd sylos-mobile && npx expo doctor
cd sylos-mobile && npx tsc --noEmit
```

- [ ] Does TypeScript compile without errors?
- [ ] Are Expo dependencies compatible?
- [ ] Does `expo start` launch without crashes?

### 4.2 — Feature Parity

Compare mobile screens against Desktop OS apps:

| Feature | Desktop | Mobile | Parity? |
|---------|---------|--------|---------|
| Agent Dashboard | AgentDashboardApp.tsx | agents.tsx | Check |
| Wallet | WalletApp.tsx | wallet.tsx | Check |
| Token Dashboard | TokenDashboardApp.tsx | token-dashboard.tsx | Check |
| PoP Tracker | PoPTrackerApp.tsx | pop-tracker.tsx | Check |
| File Manager | FileManagerApp.tsx | file-manager.tsx | Check |
| Settings | SettingsApp.tsx | settings.tsx | Check |
| Approvals | TransactionQueueApp.tsx | approvals.tsx | Check |
| Community | AgentCommunityApp.tsx | community.tsx | Check |

- [ ] Are mobile screens functional or just UI shells?
- [ ] Does the mobile app share types from `packages/shared-types`?
- [ ] Is the blockchain service connecting to the same contracts?

### 4.3 — Mobile-Specific Concerns

- [ ] Is biometric authentication (fingerprint/face) implemented?
- [ ] Is secure storage used for private keys? (Expo SecureStore)
- [ ] Are push notifications configured?
- [ ] Does offline mode work? (data syncs when reconnected)
- [ ] Is deep linking configured?

---

## PHASE 5: BACKEND AUDIT (Supabase)

### 5.1 — Database Schema

```
ls supabase/tables/
cat supabase/tables/*.sql
```

**Check for:**
- [ ] Do all 15 tables exist with proper schemas?
- [ ] Are foreign keys correctly defined?
- [ ] Are indexes on frequently queried columns?
- [ ] Is Row Level Security (RLS) enabled on ALL tables?
- [ ] Are RLS policies correct? (users can only see their own data)
- [ ] Are `created_at` / `updated_at` timestamps present?
- [ ] Are there proper constraints? (NOT NULL, UNIQUE, CHECK)

### 5.2 — Edge Functions

```
ls supabase/functions/*/index.ts
```

**For EACH edge function:**
- [ ] `agent-gateway/`: Does it validate JWT? Rate limit? Check permissions?
- [ ] `pop-tracker/`: Does it verify PoP proofs correctly?
- [ ] `wallet-operations/`: Are transaction amounts validated?
- [ ] `verify-siwe/`: Is SIWE signature verification correct?
- [ ] `user-management/`: Are CRUD operations secure?
- [ ] `api-proxy/`: What APIs does it proxy? Are there SSRF risks?
- [ ] Bucket functions: Are upload sizes limited? File types validated?

### 5.3 — Data Consistency

- [ ] Is agent data consistent between: smart contract ↔ Supabase ↔ localStorage?
- [ ] Is there a sync mechanism? Does `LocalSyncService.ts` work?
- [ ] What happens when chain data and DB data disagree?
- [ ] Are there any orphaned records? (agents in DB but not on chain)

---

## PHASE 6: SECURITY AUDIT

### 6.1 — Secrets Management

```
# Search entire repo for leaked secrets:
grep -r "0x[a-fA-F0-9]{64}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" .
grep -r "sk-\|sk_live\|pk_live\|apikey\|api_key\|secret\|password\|token" --include="*.ts" --include="*.tsx" --include="*.js" .
```

- [ ] Are ANY private keys, API keys, or secrets in source code?
- [ ] Are `.env` files in `.gitignore`?
- [ ] Has git history been checked for previously committed secrets?
- [ ] Are deployment environment variables documented but not committed?

### 6.2 — Smart Contract Security

- [ ] Are there any `selfdestruct` calls? (dangerous, remove them)
- [ ] Are there any `delegatecall` to user-supplied addresses?
- [ ] Is `tx.origin` used anywhere? (should use `msg.sender`)
- [ ] Are there any front-running vulnerabilities in token/marketplace operations?
- [ ] Can flash loan attacks exploit any contract logic?
- [ ] Are there proper access controls on all admin functions?
- [ ] Is the governance timelock sufficient? (should be 24-48 hours minimum)

### 6.3 — Frontend Security

- [ ] Is Content Security Policy (CSP) configured? (`VITE_CSP_ENABLED`)
- [ ] Are user inputs sanitized before rendering? (XSS prevention)
- [ ] Are external URLs validated before iframe loading? (WebBrowserApp)
- [ ] Is SIWE (Sign-In With Ethereum) properly implemented?
- [ ] Are API calls authenticated with proper tokens?
- [ ] Is sensitive data (keys, mnemonics) ever stored in localStorage?

### 6.4 — Agent Security

- [ ] Can an agent execute actions outside its role scope?
- [ ] Can an agent spend more than its session wallet cap?
- [ ] Can an agent impersonate another agent?
- [ ] Can an agent bypass rate limits?
- [ ] Are the 8 security gates actually enforced or just documented?
- [ ] What happens if the LLM returns malicious instructions?
- [ ] Is there prompt injection protection?

---

## PHASE 7: CROSS-SYSTEM CONSISTENCY

### 7.1 — Type Alignment

```
cat packages/shared-types/src/index.ts
```

**Verify types match across ALL systems:**

- [ ] `AgentRole` enum — same values in: shared-types, AgentRoles.ts, AgentRegistry.sol, Supabase schema, mobile types
- [ ] `AgentStatus` — same states in: shared-types, AgentRegistry.ts, AgentRegistry.sol, Supabase
- [ ] `ReputationTier` — same boundaries in: shared-types, ReputationScore.sol, AgentRuntime.ts
- [ ] `ViolationType` — same types in: SlashingEngine.sol, AgentRuntime.ts, Supabase

### 7.2 — Contract Address Alignment

- [ ] Addresses in `sylos-blockchain-os/src/config/contracts.ts` match `smart-contracts/` deployment records
- [ ] Addresses in mobile app config match desktop config
- [ ] Addresses in Supabase edge functions match (if any)

### 7.3 — ABI Alignment

- [ ] ABIs in `config/abis.ts` match the compiled artifacts in `smart-contracts/artifacts/`
- [ ] If contracts were redeployed, were ABIs updated in the frontend?

### 7.4 — Documentation Accuracy

```
# Check README.md claims against reality:
```

- [ ] Are the "deployed addresses" in README actually deployed?
- [ ] Are the feature descriptions accurate? (not claiming features that don't exist)
- [ ] Is the architecture diagram current?
- [ ] Are setup instructions correct? (can a new developer follow them?)
- [ ] Is `SYLOS_COMPLETE_PROJECT_DOCUMENTATION.md` consistent with actual code?

---

## PHASE 8: CI/CD & DEPLOYMENT

### 8.1 — GitHub Actions

```
cat .github/workflows/production.yml
```

- [ ] Does the workflow actually run? (check Actions tab)
- [ ] Are secrets properly referenced? (`${{ secrets.POLYGON_PRIVATE_KEY }}`)
- [ ] Is the Node version correct?
- [ ] Does it run tests before deploying?
- [ ] Is there a staging environment?
- [ ] Are there branch protection rules?

### 8.2 — Docker

```
cat Dockerfile
cat docker/docker-compose.yml  # if exists
```

- [ ] Does the Dockerfile build successfully?
- [ ] Is the image size reasonable? (multi-stage build?)
- [ ] Are secrets handled properly? (not baked into image)
- [ ] Is the container running as non-root?

### 8.3 — Deployment Scripts

```
ls deployment/scripts/
```

- [ ] Do deployment scripts have proper error handling?
- [ ] Are there rollback procedures?
- [ ] Is there a health check after deployment?
- [ ] Are contract verification scripts working?

---

## PHASE 9: PERFORMANCE & OPTIMIZATION

### 9.1 — Bundle Analysis

```
cd sylos-blockchain-os && npx vite-bundle-visualizer  # or equivalent
```

- [ ] What is the total bundle size?
- [ ] Are large dependencies tree-shaken? (ethers.js, etc.)
- [ ] Is code splitting working? (check chunks in `dist/`)
- [ ] Are images optimized?
- [ ] Is there a service worker for caching?

### 9.2 — Runtime Performance

- [ ] Does the agent 30-second loop cause memory leaks?
- [ ] Are there proper cleanup functions in React `useEffect`?
- [ ] Are expensive computations memoized?
- [ ] Are re-renders minimized? (React.memo, useMemo, useCallback)
- [ ] Is the EventBus leaking subscriptions?

### 9.3 — Smart Contract Gas

- [ ] Run gas reporter: `REPORT_GAS=true npx hardhat test`
- [ ] Are any functions using excessive gas?
- [ ] Can storage reads be optimized? (caching, packing structs)
- [ ] Are batch operations available where needed?

---

## PHASE 10: FINAL VERIFICATION CHECKLIST

After all fixes are applied, run this complete verification:

```bash
# 1. Clean install
rm -rf node_modules sylos-blockchain-os/node_modules smart-contracts/node_modules sylos-mobile/node_modules
pnpm install  # root
cd smart-contracts && npm install && cd ..
cd sylos-mobile && npm install && cd ..

# 2. Compile contracts
cd smart-contracts && npx hardhat compile

# 3. Run contract tests
cd smart-contracts && npx hardhat test

# 4. Build frontend
cd sylos-blockchain-os && pnpm run build

# 5. Type-check frontend
cd sylos-blockchain-os && npx tsc --noEmit

# 6. Run frontend tests
cd sylos-blockchain-os && pnpm run test

# 7. Type-check mobile
cd sylos-mobile && npx tsc --noEmit

# 8. Lint everything
cd sylos-blockchain-os && pnpm run lint  # if configured
cd smart-contracts && npx solhint 'contracts/**/*.sol'  # if configured

# 9. Check for secrets
grep -r "sk-\|private.key\|secret" --include="*.ts" --include="*.js" .

# 10. Verify git is clean
git status
```

**All 10 steps must pass for the audit to be complete.**

---

## AUDIT REPORT TEMPLATE

After completing all phases, produce a report in this format:

```markdown
# SylOS Audit Report — [DATE]

## Summary
- Total issues found: X
- Critical: X | High: X | Medium: X | Low: X
- Issues fixed: X
- Issues remaining: X

## Build Status
| Package | Install | Build | Tests | Status |
|---------|---------|-------|-------|--------|
| sylos-blockchain-os | ✅/❌ | ✅/❌ | ✅/❌ | |
| smart-contracts | ✅/❌ | ✅/❌ | ✅/❌ | |
| sylos-mobile | ✅/❌ | ✅/❌ | ✅/❌ | |
| packages/shared-types | ✅/❌ | ✅/❌ | N/A | |

## Critical Findings
1. [Finding title] — [Description] — [Fixed/Remaining]

## Mock vs Real Assessment
| Feature | Status | Details |
|---------|--------|---------|
| Agent spawning | Mock/Real | ... |
| Reputation scoring | Mock/Real | ... |
| Token transfers | Mock/Real | ... |
| Governance voting | Mock/Real | ... |
| Marketplace | Mock/Real | ... |
| Payment streaming | Mock/Real | ... |

## Security Findings
1. [Finding]

## Recommendations
1. [Priority recommendation]
```

---

## EXECUTION NOTES

- **Estimated time:** This audit should take 2-4 hours for a thorough pass
- **Priority order:** Phase 2 (contracts) > Phase 6 (security) > Phase 1 (build) > Phase 3 (frontend) > Phase 5 (backend) > Phase 7 (consistency) > Phase 4 (mobile) > Phase 8 (CI/CD) > Phase 9 (performance)
- **When in doubt:** If something looks suspicious, investigate deeper. SylOS handles real tokens and real money — security is paramount.
- **Don't assume:** The previous audit found that ~70% of claimed features were mocks, stubs, or client-side only. Verify everything yourself.
