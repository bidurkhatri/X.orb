# XORB — Complete Transformation Plan

**From**: SylOS (Blockchain City OS) → **To**: Xorb (Agent Trust Infrastructure API)

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Date | March 15, 2026 |
| Author | Bidur / Fintex |
| Domain | xorb.xyz \| x.orb (Handshake) |

---

## Executive Summary

Xorb is an API-first trust and accountability infrastructure for autonomous AI agents. It provides identity, reputation scoring, an 8-gate security pipeline, economic bonding/slashing, escrow-based marketplace, and compliance reporting — all paid per-action via the x402 protocol in USDC.

This document is the complete, phase-by-phase plan to transform the existing SylOS codebase into the Xorb product. Every file to keep, delete, rename, rewrite, or create is specified. Nothing is left ambiguous.

---

## Table of Contents

1. [Brand & Identity Changes](#1-brand--identity-changes)
2. [Architecture Overview — Before & After](#2-architecture-overview--before--after)
3. [What to DELETE](#3-what-to-delete)
4. [What to KEEP](#4-what-to-keep)
5. [What to RENAME / REBRAND](#5-what-to-rename--rebrand)
6. [What to REWRITE](#6-what-to-rewrite)
7. [What to CREATE NEW](#7-what-to-create-new)
8. [Smart Contract Changes](#8-smart-contract-changes)
9. [x402 Integration Plan](#9-x402-integration-plan)
10. [API Design (Full Endpoint Specification)](#10-api-design--full-endpoint-specification)
11. [Event System Redesign](#11-event-system-redesign)
12. [Database Schema (Supabase)](#12-database-schema-supabase--postgresql)
13. [Phased Implementation Plan](#13-phased-implementation-plan)
14. [Business Model & Pricing](#14-business-model--pricing)
15. [Go-To-Market Strategy](#15-go-to-market-strategy)
16. [Success Metrics](#16-success-metrics)
17. [Final Directory Structure](#17-final-directory-structure)

---

## 1. Brand & Identity Changes

### Naming

| Old | New |
|-----|-----|
| SylOS | Xorb |
| SYLOS token | USDC (via x402) |
| wSYLOS (wrapped) | USDC bond escrow |
| SylOS-Hosted (LLM provider) | Remove entirely |
| Agent City | Agent Registry |
| Civilization Dashboard | Dashboard (API metrics) |
| Citizens | Agent Profiles |
| Kill Switch | Emergency Controls |
| Hire Humans | Remove entirely |
| Community | Remove entirely |

### Domain Strategy

- **xorb.xyz** — Primary domain. API, docs, marketing, developer portal.
- **api.xorb.xyz** — API base URL.
- **docs.xorb.xyz** — Developer documentation.
- **x.orb** — Handshake domain. Web3 identity, on-chain agent registry reference.

### Tagline Options

- "The logic gate between AI agents and the real world"
- "Trust infrastructure for autonomous AI agents"
- "Every agent action, verified"

### Visual Identity

- Drop the desktop OS aesthetic (dark glassmorphism, app icons, window manager)
- New identity: minimal, developer-focused, monospace typography, binary/circuit aesthetic
- Primary color: electric blue (`#0066FF`) on dark (`#0A0A0A`)
- Logo concept: XOR gate symbol stylized as the X in Xorb

---

## 2. Architecture Overview — Before & After

### BEFORE (SylOS)

```
User → Desktop OS (React SPA) → localStorage → Supabase sync
                                → Smart Contracts (5 deployed on Polygon)
                                → LLM Providers (OpenAI, Groq, etc.)
```

- 24 desktop apps in a window manager
- Agent autonomy engine running in-browser
- localStorage as primary data store
- Custom ERC-20 token economy
- Mobile app (Expo/React Native)

### AFTER (Xorb)

```
Developer → Xorb REST API → Supabase (PostgreSQL)
                           → Smart Contracts (Base/Polygon)
                           → x402 payment middleware
                           → Webhook/Event delivery
```

- No frontend desktop OS
- No mobile app
- No custom token
- No in-browser agent execution
- Pure API infrastructure with a minimal developer dashboard

---

## 3. What to DELETE

These files/directories are removed entirely. They served the desktop OS metaphor and have no place in an API product.

### Desktop OS Shell (DELETE ENTIRE DIRECTORIES)

```
sylos-blockchain-os/src/components/Desktop.tsx          — Window manager
sylos-blockchain-os/src/components/AppWindow.tsx         — Draggable windows
sylos-blockchain-os/src/components/Taskbar.tsx           — Dock, system tray
sylos-blockchain-os/src/components/NotificationCenter.tsx — Desktop notifications
sylos-blockchain-os/src/components/DesktopIcon.tsx       — Per-app gradient icons
sylos-blockchain-os/src/components/ui/                   — Desktop design system (tokens, skeletons, toasts)
```

### Apps to DELETE (No API equivalent)

```
sylos-blockchain-os/src/components/apps/AgentCommunityApp.tsx   — Reddit-style forum
sylos-blockchain-os/src/components/apps/MessagesApp.tsx         — XMTP wallet messaging
sylos-blockchain-os/src/components/apps/HireHumansApp.tsx       — Agent-posts-jobs-for-humans
sylos-blockchain-os/src/components/apps/WebBrowserApp.tsx       — Sandboxed Web3 browser
sylos-blockchain-os/src/components/apps/NotesApp.tsx            — Notes app
sylos-blockchain-os/src/components/apps/FileManagerApp.tsx      — IPFS file storage
sylos-blockchain-os/src/components/apps/SettingsApp.tsx         — Desktop preferences
sylos-blockchain-os/src/components/apps/ActivityMonitorApp.tsx  — Process monitor
sylos-blockchain-os/src/components/apps/AppStoreApp.tsx         — Web3 dApp store
sylos-blockchain-os/src/components/apps/PixelWorldApp.tsx       — Pixel world app
sylos-blockchain-os/src/components/apps/DAppContainer.tsx       — DApp container
sylos-blockchain-os/src/components/apps/WalletApp.tsx           — Wallet app
sylos-blockchain-os/src/components/apps/TransactionQueueApp.tsx — Transaction queue
sylos-blockchain-os/src/components/apps/TokenDashboardApp.tsx   — Token dashboard
```

> **Note**: Merge useful identity logic from `CitizenProfileApp.tsx` and `IdentityInterface.tsx` into the new `AgentIdentity.ts` service before deleting.

### Dashboard Apps to DELETE

```
sylos-blockchain-os/src/components/dashboard/DeFiInterface.tsx       — QuickSwap V3 integration
sylos-blockchain-os/src/components/dashboard/StakingInterface.tsx    — wSYLOS staking UI
sylos-blockchain-os/src/components/dashboard/GovernanceInterface.tsx — DAO voting UI
```

### Token-Related (DELETE)

```
smart-contracts/contracts/SylOSToken.sol                 — Custom ERC-20 (replace with USDC)
smart-contracts/contracts/WrappedSYLOS.sol               — Staking wrapper (replace with USDC escrow)
smart-contracts/contracts/SylOSGovernance.sol             — DAO voting (remove entirely)
smart-contracts/contracts/SylOS_SBT.sol                  — Soulbound token (remove for now)
smart-contracts/contracts/MetaTransactionPaymaster.sol    — Gasless txns (x402 handles this)
```

### Mobile App (DELETE ENTIRE DIRECTORY)

```
sylos-mobile/                                            — Entire React Native app
```

### Tokenomics Documentation (DELETE)

```
docs/economics/TOKENOMICS_DOCUMENT.md
docs/mobile_app_architecture.md
```

### Miscellaneous (DELETE)

```
imgs/sylos_desktop.png                                   — Desktop screenshot
sylos-blockchain-os/index.html                           — Desktop OS entry point
```

---

## 4. What to KEEP

These files contain the core intellectual property. They will be refactored but the logic is preserved.

### Agent Infrastructure (KEEP & REFACTOR)

**AgentRegistry.ts**
```
sylos-blockchain-os/src/services/agent/AgentRegistry.ts
  → Refactor into: xorb-api/src/services/AgentRegistry.ts
  — Keep: Agent spawning, lifecycle management, limits (max per sponsor)
  — Remove: localStorage persistence, desktop UI hooks
  — Add: Supabase persistence, API endpoint handlers, x402 bond collection
```

**AgentRoles.ts**
```
sylos-blockchain-os/src/services/agent/AgentRoles.ts
  → Refactor into: xorb-api/src/services/AgentRoles.ts
  — Keep: 7 role definitions, permissions matrix, rate limits, tool access lists
  — Remove: LLM provider configuration (OpenAI, Groq, etc.)
  — Add: Custom role definitions via API, role validation middleware
```

**AgentAutonomyEngine.ts**
```
sylos-blockchain-os/src/services/agent/AgentAutonomyEngine.ts
  → Refactor into: xorb-api/src/services/SecurityPipeline.ts
  — Keep: The 8-gate security check logic
  — Remove: 30-second autonomy loop, in-browser agent execution
  — Reframe: This becomes the core API — every inbound action request passes through the 8 gates
```

**CitizenIdentity.ts**
```
sylos-blockchain-os/src/services/agent/CitizenIdentity.ts
  → Refactor into: xorb-api/src/services/AgentIdentity.ts
  — Keep: Full identity data model (creation record, capabilities, employment history, violations, financial profile)
  — Remove: "Citizen" language, "birth certificate", "criminal record", "visa", "lifestyle"
  — Rename: birth_certificate → creation_record, criminal_record → violation_history,
            visa → access_policy, lifestyle → activity_profile
```

### Event System (KEEP & REFACTOR)

```
sylos-blockchain-os/src/services/EventBus.ts
  → Refactor into: xorb-api/src/services/EventBus.ts
  — Keep: Typed event system, event categories
  — Remove: Desktop app subscription model
  — Add: Webhook delivery, event streaming (SSE), x402-gated event subscriptions
  — Reduce: 25 event types → ~15 (remove community, hire-humans, desktop-specific events)
```

### Smart Contracts (KEEP & MODIFY)

```
smart-contracts/contracts/AgentRegistry.sol       — KEEP. Modify to accept USDC bonds instead of wSYLOS
smart-contracts/contracts/ReputationScore.sol      — KEEP. Add ERC-8004 compatibility
smart-contracts/contracts/SlashingEngine.sol       — KEEP. Modify to slash USDC instead of wSYLOS
smart-contracts/contracts/PaymentStreaming.sol      — KEEP. Modify to stream USDC
smart-contracts/contracts/AgentMarketplace.sol     — KEEP. Modify escrow to use USDC
smart-contracts/contracts/PoPTracker.sol           — KEEP. Rename to ActionVerifier.sol
```

### Supabase (KEEP & EXPAND)

```
supabase/tables/                                  — KEEP all table definitions, expand schema
supabase/functions/agent-gateway/                  — KEEP. Refactor into proper API gateway
```

### Config (KEEP & UPDATE)

```
sylos-blockchain-os/src/config/contracts.ts       — KEEP. Update addresses after redeployment
```

---

## 5. What to RENAME / REBRAND

### File-Level Renames

| Old Path | New Path |
|----------|----------|
| `sylos-blockchain-os/` | `xorb-api/` |
| `smart-contracts/` | `xorb-contracts/` |
| `supabase/` | `xorb-db/` |
| `deployment/` | `xorb-deploy/` |
| `docs/` | `xorb-docs/` |

### Code-Level String Replacements (Global Find & Replace)

| Old String | New String |
|------------|------------|
| `SylOS` | `Xorb` |
| `sylos` | `xorb` |
| `SYLOS` | `XORB` |
| `wSYLOS` | `USDC` (context-dependent) |
| `sylOS` | `xorb` |
| `citizen` | `agent` (in identity contexts) |
| `birth_certificate` | `creation_record` |
| `criminal_record` | `violation_history` |
| `visa` | `access_policy` |
| `deportation` | `permanent_revocation` |
| `lifestyle` | `activity_profile` |

> **Keep these tier names** (they work without the civilization metaphor): Novice, Untrusted, Reliable, Trusted, Elite

### Contract Renames

| Old Contract | New Contract | Purpose |
|-------------|-------------|---------|
| `PoPTracker.sol` | `ActionVerifier.sol` | Verify agent work completion |
| `SylOSToken.sol` | DELETE | Replaced by USDC |
| `WrappedSYLOS.sol` | DELETE | Replaced by USDC escrow |
| `SylOSGovernance.sol` | DELETE | No DAO governance |
| `SylOS_SBT.sol` | DELETE | No soulbound tokens |
| `MetaTransactionPaymaster.sol` | DELETE | x402 handles gasless |

---

## 6. What to REWRITE

These components exist in SylOS but need fundamental architectural changes.

### 6.1 Security Pipeline (formerly AgentAutonomyEngine)

**Old**: In-browser loop that runs every 30 seconds, checks gates, executes LLM calls.
**New**: Stateless API middleware that validates every inbound action request.

```typescript
// NEW: xorb-api/src/middleware/SecurityPipeline.ts

interface GateResult {
  gate: string;
  passed: boolean;
  reason?: string;
  latency_ms: number;
}

interface PipelineResult {
  action_id: string;
  agent_id: string;
  approved: boolean;
  gates: GateResult[];
  reputation_delta: number;
  audit_hash: string;      // SHA-256 hash of full gate results, stored on-chain
  timestamp: string;
}

// The 8 gates execute in order. If any gate fails, the pipeline halts.
// Gate 1: Role Check — Is this tool/action allowed for this agent's role?
// Gate 2: Rate Limit — Has the agent exceeded its hourly action limit?
// Gate 3: Spend Limit — Does this action exceed the per-action spending cap?
// Gate 4: Scope Boundary — Is the agent operating within its defined permission scope?
// Gate 5: Audit Log — Record the action attempt regardless of outcome.
// Gate 6: Human Override — Does this action require sponsor approval first?
// Gate 7: Time Sandbox — Is the agent's access policy still valid (not expired)?
// Gate 8: Reputation Gate — Does the agent's reputation tier allow this action?
```

### 6.2 Reputation System

**Old**: In-memory scoring with localStorage persistence.
**New**: Supabase-backed scoring with on-chain anchoring and ERC-8004 compatibility.

```typescript
// NEW: xorb-api/src/services/ReputationEngine.ts

interface ReputationUpdate {
  agent_id: string;
  action_type: string;
  outcome: 'success' | 'failure' | 'violation';
  points_delta: number;
  new_score: number;
  new_tier: 'Untrusted' | 'Novice' | 'Reliable' | 'Trusted' | 'Elite';
  evidence_cid?: string;   // IPFS CID of evidence data
  erc8004_feedback?: {     // ERC-8004 compatible feedback record
    from_agent: string;
    score: number;
    tags: string[];
    context: string;
  };
}
```

### 6.3 Agent Identity

**Old**: "Citizen Identity" with birth certificates, criminal records, visas, lifestyle data.
**New**: Agent Profile with creation record, capability manifest, violation history, activity profile.

```typescript
// NEW: xorb-api/src/models/AgentProfile.ts

interface AgentProfile {
  // Core Identity
  agent_id: string;               // UUID
  name: string;
  role: AgentRole;
  sponsor_wallet: string;         // Ethereum address of human sponsor
  created_at: string;
  creation_method: 'api' | 'marketplace' | 'bulk';

  // Capability Manifest
  capabilities: {
    tools: string[];              // Allowed tool names
    contracts: string[];          // Allowed contract addresses
    rate_limit: number;           // Actions per hour
    spend_limit_usdc: number;     // Per-action max in USDC
    scope: string[];              // Permission scope boundaries
  };

  // Verification Status
  verification: {
    level: 0 | 1 | 2 | 3 | 4;   // Unverified → Sovereign
    verified_at?: string;
    verification_method?: string;
    erc8004_id?: string;          // On-chain ERC-8004 registry ID
  };

  // Reputation
  reputation: {
    score: number;                // 0-10000
    tier: ReputationTier;
    history: ReputationEvent[];
  };

  // Violation History
  violations: {
    total_count: number;
    total_slash_usdc: number;
    total_reputation_lost: number;
    status: 'Clean' | 'Warning' | 'Probation' | 'Suspended' | 'Revoked';
    records: ViolationRecord[];
  };

  // Employment History
  engagements: {
    total: number;
    completed: number;
    avg_rating: number;
    total_earned_usdc: number;
    records: EngagementRecord[];
  };

  // Financial Profile
  financial: {
    bond_amount_usdc: number;
    bond_status: 'active' | 'slashed' | 'released';
    lifetime_earned_usdc: number;
    lifetime_spent_usdc: number;
    active_streams: number;
  };

  // Activity Profile
  activity: {
    pattern: 'continuous' | 'burst' | 'scheduled' | 'idle';
    avg_actions_per_day: number;
    peak_hours: number[];
    last_action_at: string;
  };

  // Access Policy
  access: {
    type: 'permanent' | 'temporary' | 'trial';
    expires_at?: string;
    restrictions: string[];
  };

  // Status
  status: 'active' | 'paused' | 'revoked';
  paused_at?: string;
  revoked_at?: string;
}
```

### 6.4 Marketplace

**Old**: In-browser marketplace with localStorage listings.
**New**: API-driven marketplace with x402 escrow.

The marketplace becomes a set of API endpoints, not a UI. Agents are listed, discovered, hired, and rated entirely via API. Escrow is handled by the modified `AgentMarketplace.sol` contract using USDC.

### 6.5 Kill Switch → Emergency Controls

**Old**: Desktop UI buttons for pause/resume/revoke.
**New**: API endpoints with instant execution and webhook notification.

```
POST /agents/{id}/pause    — Instant. Retains state. All pending actions rejected.
POST /agents/{id}/resume   — Restores from pause.
POST /agents/{id}/revoke   — Permanent. Bond slashed to zero. Status set to revoked forever.
```

---

## 7. What to CREATE NEW

These components don't exist in SylOS and must be built from scratch.

### 7.1 API Server

```
xorb-api/
├── src/
│   ├── index.ts                    — Express/Hono server entry point
│   ├── middleware/
│   │   ├── SecurityPipeline.ts     — 8-gate check (refactored from AgentAutonomyEngine)
│   │   ├── x402Middleware.ts       — x402 payment verification
│   │   ├── rateLimiter.ts          — API-level rate limiting (separate from agent rate limits)
│   │   ├── auth.ts                 — Wallet-based authentication (SIWE)
│   │   └── cors.ts                 — CORS configuration
│   ├── routes/
│   │   ├── agents.ts               — /agents/* endpoints
│   │   ├── reputation.ts           — /reputation/* endpoints
│   │   ├── marketplace.ts          — /marketplace/* endpoints
│   │   ├── actions.ts              — /actions/* endpoints (the core 8-gate pipeline)
│   │   ├── audit.ts                — /audit/* endpoints
│   │   ├── webhooks.ts             — /webhooks/* endpoints
│   │   └── health.ts               — /health endpoint
│   ├── services/
│   │   ├── AgentRegistry.ts        — Agent CRUD + lifecycle
│   │   ├── AgentRoles.ts           — Role definitions + permissions
│   │   ├── AgentIdentity.ts        — Full agent profile management
│   │   ├── ReputationEngine.ts     — Scoring + tier management
│   │   ├── SlashingService.ts      — Violation detection + bond slashing
│   │   ├── EscrowService.ts        — Marketplace escrow management
│   │   ├── AuditService.ts         — Audit log generation + compliance reports
│   │   ├── WebhookService.ts       — Event delivery to subscribers
│   │   └── EventBus.ts             — Internal event system
│   ├── models/
│   │   ├── AgentProfile.ts         — Agent identity type definitions
│   │   ├── GateResult.ts           — Security pipeline result types
│   │   ├── Reputation.ts           — Reputation types
│   │   ├── Violation.ts            — Violation types
│   │   ├── Engagement.ts           — Marketplace engagement types
│   │   └── AuditRecord.ts          — Audit log types
│   ├── config/
│   │   ├── contracts.ts            — Deployed contract addresses
│   │   ├── roles.ts                — Default role definitions
│   │   ├── gates.ts                — Gate configuration (thresholds, timeouts)
│   │   └── pricing.ts              — x402 pricing per endpoint
│   └── lib/
│       ├── supabase.ts             — Supabase client
│       ├── blockchain.ts           — viem/ethers client for contract interaction
│       ├── x402.ts                 — x402 client/server utilities
│       └── erc8004.ts              — ERC-8004 compatibility utilities
├── package.json
├── tsconfig.json
└── Dockerfile
```

### 7.2 x402 Payment Integration

```
xorb-api/src/middleware/x402Middleware.ts
```

This is the payment layer. Every paid endpoint returns HTTP 402 if no payment is attached.

```typescript
// Pricing configuration
const PRICING = {
  'POST /agents/register':        { usdc: 0.10, description: 'Agent registration' },
  'POST /actions/execute':         { usdc: 0.005, description: 'Per-action gate check' },
  'GET /reputation/:id':          { usdc: 0.001, description: 'Reputation lookup' },
  'POST /marketplace/hire':       { usdc: 0.05, description: 'Marketplace hire initiation' },
  'GET /audit/:id/report':        { usdc: 1.00, description: 'Compliance report generation' },
  'POST /webhooks/subscribe':     { usdc: 0.10, description: 'Webhook subscription (monthly)' },
  // Free endpoints
  'GET /health':                  { usdc: 0, description: 'Health check' },
  'POST /agents/:id/pause':      { usdc: 0, description: 'Emergency pause (always free)' },
  'POST /agents/:id/revoke':     { usdc: 0, description: 'Emergency revoke (always free)' },
  'GET /agents/:id/status':      { usdc: 0, description: 'Agent status check' },
};
```

### 7.3 SDK (TypeScript + Python)

**TypeScript SDK:**
```
xorb-sdk-ts/
├── src/
│   ├── index.ts                   — Main export
│   ├── client.ts                  — XorbClient class
│   ├── agents.ts                  — Agent management methods
│   ├── actions.ts                 — Action execution (8-gate pipeline)
│   ├── reputation.ts              — Reputation queries
│   ├── marketplace.ts             — Marketplace operations
│   ├── audit.ts                   — Audit log access
│   ├── webhooks.ts                — Webhook management
│   ├── types.ts                   — All TypeScript type definitions
│   └── x402.ts                    — x402 payment handling
├── package.json
└── README.md
```

**Python SDK:**
```
xorb-sdk-py/
├── xorb/
│   ├── __init__.py
│   ├── client.py                  — XorbClient class
│   ├── agents.py
│   ├── actions.py
│   ├── reputation.py
│   ├── marketplace.py
│   ├── audit.py
│   ├── webhooks.py
│   ├── types.py
│   └── x402.py
├── setup.py
└── README.md
```

**SDK Usage Example (TypeScript):**

```typescript
import { XorbClient } from '@xorb/sdk';

const xorb = new XorbClient({
  apiUrl: 'https://api.xorb.xyz',
  walletKey: process.env.WALLET_PRIVATE_KEY,
  chain: 'base',  // or 'polygon'
});

// Register an agent
const agent = await xorb.agents.register({
  name: 'research-bot',
  role: 'researcher',
  bond_usdc: 50,
  capabilities: {
    tools: ['web_search', 'chain_query', 'file_read'],
    rate_limit: 120,
    spend_limit_usdc: 0,
  },
});

// Execute an action through the 8-gate pipeline
const result = await xorb.actions.execute({
  agent_id: agent.id,
  action: 'chain_query',
  params: { contract: '0x...', method: 'balanceOf' },
});

if (result.approved) {
  console.log('Action approved. Audit hash:', result.audit_hash);
  console.log('Reputation delta:', result.reputation_delta);
} else {
  console.log('Blocked at gate:', result.gates.find(g => !g.passed)?.gate);
}

// Check reputation
const rep = await xorb.reputation.get(agent.id);
console.log(`Score: ${rep.score}, Tier: ${rep.tier}`);

// Subscribe to events
await xorb.webhooks.subscribe({
  url: 'https://myapp.com/webhooks/xorb',
  events: ['agent.slashed', 'reputation.changed', 'action.blocked'],
});
```

### 7.4 Developer Dashboard — Full Specification

A developer dashboard for sponsors to monitor and manage their agents. **Design: Stripe-like layout with Liquid Glass visual treatment.** Deployed at `dashboard.xorb.xyz`.

#### Design Direction: Stripe Layout + Liquid Glass

**Layout**: Stripe dashboard structure — fixed sidebar navigation on the left (220px), content area on the right. Clean, data-dense, professional. No desktop OS metaphor.

**Visual Treatment** — Liquid Glass on dark canvas:
- **Background**: Dark base `#0A0A0A` with subtle gradient mesh (`radial-gradient` with `#0066FF08` spots)
- **Cards**: Frosted glass — `background: rgba(255,255,255,0.05)`, `backdrop-filter: blur(20px)`, `border: 1px solid rgba(255,255,255,0.08)`, subtle inner glow on hover
- **Primary accent**: Electric blue `#0066FF`
- **Success/Error/Warning**: `#22c55e` / `#ef4444` / `#f59e0b`
- **Typography**: Inter for UI labels, JetBrains Mono for data (numbers, hashes, IDs, code, USDC amounts)
- **No heavy gradients**, no neon glow, no window managers — clean glass cards on dark
- **Border radius**: 12px for cards, 8px for inputs/buttons, 4px for badges
- **Spacing**: 8/12/16/20/24px increments (consistent with Stripe density)

**Reuse from SylOS** (adapt, don't copy verbatim):
- `sylos-blockchain-os/src/components/ui/index.tsx` — Skeleton loaders, EmptyState, Toast system, ProgressBar, PulseDot, StatValue, Avatar
- `sylos-blockchain-os/tailwind.config.js` — Accessibility utilities (focus-ring, touch-target, sr-only), adapt color palette to Xorb brand
- `sylos-blockchain-os/src/index.css` — Glass utilities (`.glass`, `.glass-heavy`), scrollbar styling, `@keyframes shimmer`
- Layout patterns from `KillSwitchPanel.tsx` (status grid + action log) and `ReputationExplorer.tsx` (sortable list with expandable rows)

#### Pages (9 total)

**1. Overview (`/`)**
- **Metric cards** (glass): Active Agents, Total Gate Checks (today), Pass Rate %, Revenue (USDC today)
- **Gate Pipeline chart**: Pass/block rate over time (line or area chart, last 7 days)
- **Live Action Feed**: Real-time SSE-powered list showing latest actions with gate results, agent name, timestamp, latency
- **Reputation Distribution**: Tier breakdown (Untrusted → Elite) as horizontal stacked bar

**2. Agents (`/agents`)**
- **Agent table**: Name, Role, Status (dot indicator), Reputation (score + tier badge), Bond (USDC), Created, Actions column
- **Filters**: Status (active/paused/revoked), Role, Reputation tier
- **Search**: By name or agent ID
- **Bulk actions**: Pause selected, Export CSV
- **Register Agent button** → modal form (name, role, bond amount, capabilities)

**3. Agent Detail (`/agents/:id`)**
- **Profile header**: Name, role, status, reputation badge, bond amount, wallet address (truncated + copy)
- **Tabs**: Overview | Actions | Reputation | Violations | Engagements
- **Overview tab**: Capability manifest, access policy, financial summary, activity pattern (24h heatmap)
- **Actions tab**: Paginated action log with gate result expansion (click row to see all 8 gates)
- **Reputation tab**: Score history chart, tier transitions timeline
- **Violations tab**: Violation records with severity badges, slash amounts
- **Engagements tab**: Marketplace engagement history with ratings
- **Emergency controls**: Pause / Resume / Revoke buttons (with confirmation modal for revoke)

**4. Actions (`/actions`)**
- **Real-time action log**: Auto-updating via SSE
- **Columns**: Timestamp, Agent, Action Type, Tool, Approved (checkmark/X), Failed Gate, Latency, Audit Hash
- **Expandable rows**: Click to show all 8 gate results with pass/fail, reason, latency per gate
- **Filters**: Agent, Approved/Blocked, Date range, Action type
- **Gate Result Badge component**: Green checkmark or red X with gate name tooltip

**5. Marketplace (`/marketplace`)**
- **Browse tab**: Available agent listings with glass cards — Agent name, role, reputation badge, rate (USDC/hr or /action), capabilities, rating stars
- **My Listings tab**: Sponsor's own listed agents with toggle availability
- **My Engagements tab**: Active and completed engagements with status, escrow amount, rating
- **Hire flow**: Select listing → confirm escrow amount → sign transaction
- **Dispute flow**: Open dispute button on active engagements

**6. Audit (`/audit`)**
- **Agent selector**: Dropdown to pick agent
- **Audit log table**: Timestamp, Event type, Details, Audit hash, On-chain anchor status
- **Compliance reports**: Generate button with format selector (EU AI Act, NIST, SOC 2, JSON)
- **Export**: Download CSV of raw audit data
- **Report preview**: Modal showing report summary before download

**7. Webhooks (`/webhooks`)**
- **Subscription list**: URL, event types (as tag chips), status (active/inactive), last delivery status
- **Add subscription**: Modal with URL input, event type multi-select, auto-generated HMAC secret (with copy)
- **Delivery log**: Click subscription to see delivery attempts — timestamp, status code, response time, success/fail
- **Test button**: Send test event to a subscription

**8. Billing (`/billing`)**
- **Usage summary**: Total USDC spent (this month), breakdown by endpoint category (pie chart)
- **Transaction history table**: Timestamp, Endpoint, Amount (USDC), x402 payment ID, Status
- **Free tier usage**: Bar showing X/1,000 free gate checks used this month
- **Bond summary**: Total USDC bonded across all agents, bond status per agent

**9. Settings (`/settings`)**
- **API Keys**: List with name, created date, last used, permissions — Create/Revoke buttons
- **Wallet connection**: Connected wallet address, SIWE session status
- **Default configuration**: Default bond amount, default role, default rate limits
- **Notification preferences**: Email alerts for violations, slashing, bond depletion

#### Component Library

```
xorb-dashboard/
├── src/
│   ├── App.tsx                    — Main layout (Sidebar + content router)
│   ├── pages/
│   │   ├── Overview.tsx
│   │   ├── Agents.tsx
│   │   ├── AgentDetail.tsx
│   │   ├── Actions.tsx
│   │   ├── Marketplace.tsx
│   │   ├── Audit.tsx
│   │   ├── Webhooks.tsx
│   │   ├── Billing.tsx
│   │   └── Settings.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx        — Fixed left sidebar with nav links + active state
│   │   │   └── PageHeader.tsx     — Page title + optional action buttons
│   │   ├── glass/
│   │   │   ├── GlassCard.tsx      — Base glass card with backdrop blur, border, optional glow
│   │   │   └── MetricCard.tsx     — Glass card with label, large value, sublabel, trend indicator
│   │   ├── agents/
│   │   │   ├── AgentCard.tsx      — Compact agent card (name, role, status dot, reputation)
│   │   │   ├── StatusDot.tsx      — Animated dot: green/amber/red
│   │   │   └── ReputationBadge.tsx — Tier + score pill badge (color by tier)
│   │   ├── actions/
│   │   │   ├── GateResultBadge.tsx — Pass/fail badge with gate name tooltip
│   │   │   ├── ActionTimeline.tsx  — Vertical timeline with gate expansion
│   │   │   └── LiveFeed.tsx       — SSE-connected auto-updating list
│   │   ├── data/
│   │   │   ├── DataTable.tsx      — Sortable, filterable table with pagination
│   │   │   └── TagChip.tsx        — Small labeled chips for event types, capabilities
│   │   └── shared/
│   │       ├── ConfirmModal.tsx   — Two-step confirmation for destructive actions
│   │       ├── CopyButton.tsx     — Click-to-copy with tooltip feedback
│   │       ├── EmptyState.tsx     — Icon + title + description + action button
│   │       ├── Skeleton.tsx       — Shimmer loading placeholders
│   │       └── Toast.tsx          — Notification toasts (success/error/info/warning)
│   ├── hooks/
│   │   ├── useXorbAPI.ts          — TanStack Query hooks for all API endpoints
│   │   ├── useSSE.ts              — EventSource hook for live feeds
│   │   └── useAuth.ts             — SIWE auth state
│   ├── lib/
│   │   ├── api.ts                 — Fetch wrapper with auth headers
│   │   └── format.ts              — Number/date/address formatting utilities
│   └── styles/
│       ├── glass.css              — Glass card utilities (adapted from SylOS)
│       └── globals.css            — Base styles, scrollbar, animations
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

#### Dashboard Tech Stack

- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS (adapted from SylOS config) + custom glass CSS utilities
- **Data fetching**: TanStack React Query (already in SylOS deps)
- **Charts**: Recharts (lightweight, React-native charting)
- **Real-time**: EventSource (SSE) for live action feeds
- **Auth**: SIWE (Sign-In With Ethereum) via wagmi (already in SylOS deps)
- **Routing**: React Router v6 (already in SylOS deps)
- **Icons**: Lucide React (already in SylOS deps)

### 7.5 MCP Security Middleware

An MCP server that wraps the Xorb 8-gate pipeline, allowing any MCP-connected agent to get security gating without changing their code.

```
xorb-mcp/
├── src/
│   ├── index.ts                   — MCP server entry
│   ├── tools/
│   │   ├── gated_tool_call.ts     — Wraps any tool call through 8 gates
│   │   ├── register_agent.ts      — Register via MCP
│   │   ├── check_reputation.ts    — Query reputation via MCP
│   │   └── emergency_stop.ts      — Kill switch via MCP
│   └── config.ts
├── package.json
└── README.md
```

**Usage in Claude Desktop / MCP config:**

```json
{
  "mcpServers": {
    "xorb": {
      "url": "https://mcp.xorb.xyz/sse",
      "env": {
        "XORB_API_KEY": "xorb_...",
        "AGENT_ID": "agent_..."
      }
    }
  }
}
```

### 7.6 Compliance Report Generator

```
xorb-api/src/services/ComplianceReporter.ts
```

Generates reports from audit logs in formats required by:

- **EU AI Act** — Risk classification, human oversight documentation, bias controls
- **NIST AI RMF** — Risk management framework compliance evidence
- **SOC 2** — Security controls documentation

Output formats: JSON, PDF, CSV.

---

## 8. Smart Contract Changes

### Contracts to Redeploy (Modified)

All contracts switch from SYLOS/wSYLOS denomination to USDC.

**Target Chain**: Base (Coinbase L2) — aligns with x402 ecosystem. Keep Polygon as secondary.

### AgentRegistry.sol — Modifications

```solidity
// OLD: Bond in wSYLOS
// function registerAgent(uint256 bondAmount) external;
// bondToken = wSYLOS

// NEW: Bond in USDC
// function registerAgent(uint256 bondAmountUSDC) external;
// bondToken = USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 on Base)

// Add: ERC-8004 metadata emission on registration
// Add: x402 facilitator integration for gasless bond deposits
// Add: Sponsor delegation (allow smart wallets to manage agents)
```

### ReputationScore.sol — Modifications

```solidity
// Add: ERC-8004 IReputationFeedback interface
// Add: Cross-platform reputation import (read from other ERC-8004 registries)
// Add: Reputation decay (inactive agents slowly lose points)
// Add: Batch update function for gas efficiency
```

### SlashingEngine.sol — Modifications

```solidity
// Change: Slash USDC instead of wSYLOS
// Add: Graduated slashing based on violation severity
//   Minor:    5% of bond + 100 reputation
//   Moderate: 20% of bond + 500 reputation + probation
//   Severe:   50% of bond + 1000 reputation + suspension
//   Critical: 100% of bond + permanent revocation
// Add: Slashed funds routing (50% to sponsor, 50% to protocol treasury)
// Add: Appeal mechanism (time-locked, requires sponsor approval)
```

### PaymentStreaming.sol — Modifications

```solidity
// Change: Stream USDC instead of SYLOS
// Add: x402 compatible payment initiation
// Add: Multi-stream management (one sponsor → many agents)
// Add: Auto-pause stream on agent pause/revoke
```

### AgentMarketplace.sol — Modifications

```solidity
// Change: Escrow in USDC instead of wSYLOS
// Add: x402 payment integration for hire transactions
// Add: Dispute resolution with time-locked arbitration
// Add: Rating system (1-5 stars + text feedback, stored as ERC-8004 attestation)
// Change: Protocol fee 2.5% → configurable (default 2%)
```

### ActionVerifier.sol (renamed from PoPTracker.sol)

```solidity
// Rename: PoPTracker → ActionVerifier
// Change: Verify agent action completion instead of "productivity"
// Add: Batch verification for gas efficiency
// Add: Action hash anchoring (SHA-256 of gate results stored on-chain)
// Add: x402 micropayment trigger on successful verification
```

### New Contract: XorbEscrow.sol

```solidity
// Purpose: Unified escrow contract for bonds, marketplace payments, and streams
// Features:
//   - USDC deposit/withdrawal with sponsor authorization
//   - Conditional release based on smart contract conditions
//   - Yield generation on escrowed funds (optional Aave/Compound integration)
//   - x402 facilitator whitelisting
//   - Emergency withdrawal by sponsor (with time-lock for active engagements)
```

### Deployment Script

```
xorb-contracts/scripts/deploy-xorb.js
```

Deploy order:
1. `XorbEscrow.sol` (depends on USDC address)
2. `AgentRegistry.sol` (depends on XorbEscrow)
3. `ReputationScore.sol` (standalone)
4. `SlashingEngine.sol` (depends on AgentRegistry, XorbEscrow)
5. `ActionVerifier.sol` (depends on AgentRegistry, ReputationScore)
6. `PaymentStreaming.sol` (depends on XorbEscrow)
7. `AgentMarketplace.sol` (depends on AgentRegistry, XorbEscrow, ReputationScore)

---

## 9. x402 Integration Plan

### Server-Side (Express Middleware)

```typescript
// xorb-api/src/middleware/x402Middleware.ts

import { paymentMiddleware } from '@x402/express';

app.use(paymentMiddleware({
  'POST /agents/register': {
    accepts: [
      {
        network: 'eip155:8453',  // Base
        asset: 'USDC',
        amount: '100000',        // $0.10 in USDC (6 decimals)
      },
      {
        network: 'solana:mainnet',
        asset: 'USDC',
        amount: '100000',
      }
    ],
    description: 'Register a new agent on Xorb',
  },
  'POST /actions/execute': {
    accepts: [{
      network: 'eip155:8453',
      asset: 'USDC',
      amount: '5000',             // $0.005 per action
    }],
    description: 'Execute an action through the 8-gate security pipeline',
  },
  // ... all paid endpoints
}));
```

### Client-Side (SDK)

```typescript
// xorb-sdk-ts/src/x402.ts

import { wrapFetchWithPayment } from '@x402/fetch';

const paidFetch = wrapFetchWithPayment(fetch, {
  walletKey: process.env.WALLET_PRIVATE_KEY,
  network: 'eip155:8453',
});

// Automatically handles 402 responses, signs payment, retries
const response = await paidFetch('https://api.xorb.xyz/actions/execute', {
  method: 'POST',
  body: JSON.stringify({ agent_id: '...', action: '...' }),
});
```

### Free Tier

- 1,000 gate checks/month free (no x402 required)
- Health checks always free
- Emergency controls (pause/revoke) always free
- Agent status checks always free

---

## 10. API Design — Full Endpoint Specification

**Base URL**: `https://api.xorb.xyz/v1`

### Authentication

All requests require wallet-based auth via Sign-In With Ethereum (SIWE) header, OR an API key generated from the dashboard.

```
Authorization: Bearer xorb_sk_...
```

### Agents

```
POST   /agents                      — Register a new agent (x402: $0.10)
GET    /agents                      — List your agents (free)
GET    /agents/:id                  — Get agent profile (free)
PATCH  /agents/:id                  — Update agent configuration (x402: $0.05)
DELETE /agents/:id                  — Permanently revoke agent (free)
POST   /agents/:id/pause            — Pause agent (free)
POST   /agents/:id/resume           — Resume agent (free)
GET    /agents/:id/history          — Full action history (x402: $0.01)
```

### Actions (Core Product — 8-Gate Pipeline)

```
POST   /actions/execute             — Submit action for 8-gate check (x402: $0.005)
POST   /actions/batch               — Batch submit up to 100 actions (x402: $0.003/action)
GET    /actions/:id                 — Get action result + gate details (free)
GET    /actions/:id/audit           — Get full audit record (x402: $0.01)
```

### Reputation

```
GET    /reputation/:agent_id        — Get reputation score + tier (x402: $0.001)
GET    /reputation/:agent_id/history — Reputation change history (x402: $0.005)
POST   /reputation/:agent_id/feedback — Submit ERC-8004 feedback (x402: $0.01)
GET    /reputation/leaderboard      — Top agents by score (free)
```

### Marketplace

```
POST   /marketplace/listings        — List an agent for hire (x402: $0.05)
GET    /marketplace/listings        — Browse available agents (free)
GET    /marketplace/listings/:id    — Get listing details (free)
POST   /marketplace/hire            — Hire an agent (x402: $0.05 + escrow)
POST   /marketplace/complete        — Mark engagement complete (free)
POST   /marketplace/dispute         — Open dispute (x402: $0.10)
POST   /marketplace/rate            — Rate completed engagement (free)
```

### Audit & Compliance

```
GET    /audit/:agent_id             — Get audit log (x402: $0.01)
GET    /audit/:agent_id/report      — Generate compliance report (x402: $1.00)
         ?format=eu-ai-act
         ?format=nist-ai-rmf
         ?format=soc2
         ?format=json
GET    /audit/:agent_id/export      — Export raw audit data as CSV (x402: $0.50)
```

### Webhooks

```
POST   /webhooks                    — Subscribe to events (x402: $0.10/month)
GET    /webhooks                    — List subscriptions (free)
DELETE /webhooks/:id                — Unsubscribe (free)
GET    /webhooks/:id/deliveries     — Delivery log (free)
POST   /webhooks/:id/test           — Send test event (free)
```

### Events (SSE Streaming)

```
GET    /events/stream               — Server-Sent Events stream (x402: $0.001/min)
         ?agent_id=...
         ?event_types=agent.slashed,action.blocked
```

### Health

```
GET    /health                      — API status (always free)
GET    /health/contracts            — Smart contract status (always free)
```

---

## 11. Event System Redesign

### Reduced Event Types (25 → 15)

| Category | Event | Description |
|----------|-------|-------------|
| Agent Lifecycle | `agent.registered` | Agent created and bonded |
| | `agent.paused` | Agent paused by sponsor |
| | `agent.resumed` | Agent resumed |
| | `agent.revoked` | Agent permanently revoked |
| Actions | `action.approved` | Action passed all 8 gates |
| | `action.blocked` | Action failed at a gate |
| | `action.verified` | Action completion verified on-chain |
| Reputation | `reputation.changed` | Score increased or decreased |
| | `reputation.tier_changed` | Agent moved to new tier |
| Violations | `agent.warned` | Minor violation, warning issued |
| | `agent.slashed` | Bond partially or fully slashed |
| | `agent.suspended` | Agent auto-suspended |
| Marketplace | `listing.created` | Agent listed for hire |
| | `engagement.started` | Agent hired, escrow funded |
| | `engagement.completed` | Engagement complete, escrow released |

### Webhook Payload Format

```json
{
  "id": "evt_abc123",
  "type": "agent.slashed",
  "created_at": "2026-03-15T10:30:00Z",
  "data": {
    "agent_id": "agt_xyz789",
    "violation_type": "moderate",
    "slash_amount_usdc": 10.00,
    "reputation_lost": 500,
    "new_score": 2500,
    "new_tier": "Novice",
    "gate_failed": "spend_limit",
    "audit_hash": "0xabc..."
  }
}
```

---

## 12. Database Schema (Supabase / PostgreSQL)

### Tables

```sql
-- Agents
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  sponsor_wallet TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',  -- active, paused, revoked
  bond_amount_usdc DECIMAL(18,6) NOT NULL DEFAULT 50,
  bond_status TEXT NOT NULL DEFAULT 'active',  -- active, slashed, released
  reputation_score INTEGER NOT NULL DEFAULT 1000,
  reputation_tier TEXT NOT NULL DEFAULT 'Novice',
  verification_level INTEGER NOT NULL DEFAULT 0,
  erc8004_id TEXT,
  on_chain_tx TEXT,
  capabilities JSONB NOT NULL,
  access_policy JSONB NOT NULL DEFAULT '{"type": "permanent"}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paused_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Actions (Core — every gate check is recorded)
CREATE TABLE actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  action_type TEXT NOT NULL,
  tool TEXT,
  params JSONB,
  approved BOOLEAN NOT NULL,
  gate_results JSONB NOT NULL,  -- Array of {gate, passed, reason, latency_ms}
  reputation_delta INTEGER NOT NULL DEFAULT 0,
  audit_hash TEXT NOT NULL,     -- SHA-256
  on_chain_anchor TEXT,         -- Transaction hash if anchored
  x402_payment_id TEXT,         -- x402 settlement reference
  latency_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Violations
CREATE TABLE violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  severity TEXT NOT NULL,       -- minor, moderate, severe, critical
  violation_type TEXT NOT NULL,
  description TEXT,
  slash_amount_usdc DECIMAL(18,6),
  reputation_lost INTEGER,
  gate_failed TEXT,
  action_id UUID REFERENCES actions(id),
  on_chain_tx TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reputation History
CREATE TABLE reputation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  event_type TEXT NOT NULL,     -- action_success, action_failure, violation, engagement_rating
  points_delta INTEGER NOT NULL,
  new_score INTEGER NOT NULL,
  new_tier TEXT NOT NULL,
  source_id UUID,               -- action_id or engagement_id
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Marketplace Listings
CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  rate_usdc_per_hour DECIMAL(18,6),
  rate_usdc_per_action DECIMAL(18,6),
  description TEXT,
  available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Engagements
CREATE TABLE engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  hirer_wallet TEXT NOT NULL,
  escrow_amount_usdc DECIMAL(18,6) NOT NULL,
  escrow_status TEXT NOT NULL DEFAULT 'funded',  -- funded, released, disputed, refunded
  status TEXT NOT NULL DEFAULT 'active',          -- active, completed, disputed, cancelled
  rating INTEGER,               -- 1-5
  feedback TEXT,
  on_chain_tx TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Webhook Subscriptions
CREATE TABLE webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_wallet TEXT NOT NULL,
  url TEXT NOT NULL,
  event_types TEXT[] NOT NULL,
  secret TEXT NOT NULL,          -- HMAC signing secret
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook Deliveries
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL
);

-- API Keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_wallet TEXT NOT NULL,
  key_hash TEXT NOT NULL,        -- SHA-256 of the API key
  name TEXT,
  permissions TEXT[] NOT NULL DEFAULT '{"read", "write"}',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);
```

### Indexes

```sql
CREATE INDEX idx_agents_sponsor ON agents(sponsor_wallet);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_reputation ON agents(reputation_score DESC);
CREATE INDEX idx_actions_agent ON actions(agent_id);
CREATE INDEX idx_actions_created ON actions(created_at DESC);
CREATE INDEX idx_actions_approved ON actions(approved);
CREATE INDEX idx_violations_agent ON violations(agent_id);
CREATE INDEX idx_reputation_agent ON reputation_events(agent_id);
CREATE INDEX idx_engagements_agent ON engagements(agent_id);
CREATE INDEX idx_webhooks_sponsor ON webhook_subscriptions(sponsor_wallet);
```

### Row Level Security (RLS)

```sql
-- Sponsors can only see their own agents
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY agents_sponsor_policy ON agents
  USING (sponsor_wallet = current_setting('app.current_wallet'));

-- Similar policies for actions, violations, etc.
```

---

## 13. Phased Implementation Plan

### Phase 1: Foundation (Weeks 1–4)

**Goal**: New repo structure, database, basic API shell, brand assets.

- [ ] Create `xorb-api/` repository
- [ ] Set up Express/Hono server with TypeScript
- [ ] Configure Supabase project with all tables from Section 12
- [ ] Implement SIWE authentication middleware
- [ ] Implement API key generation and validation
- [ ] Set up CORS, rate limiting, health check
- [ ] Create xorb.xyz landing page (single page — "Coming soon" + email capture)
- [ ] Design logo and visual identity
- [ ] Set up CI/CD pipeline (GitHub Actions → Railway/Fly.io)
- [ ] Port `AgentRoles.ts` — 7 role definitions with permissions
- [ ] Port `AgentRegistry.ts` — agent CRUD with Supabase persistence
- [ ] Port `AgentIdentity.ts` — full profile model (renamed from CitizenIdentity)
- [ ] Implement basic endpoints: POST/GET/PATCH/DELETE `/agents`
- [ ] Write integration tests for agent lifecycle

**Deliverable**: Working API that can register, list, update, pause, resume, and revoke agents. All data persisted in Supabase.

### Phase 2: Core API — 8-Gate Pipeline (Weeks 5–8)

**Goal**: The core product — the security pipeline — is live and testable.

- [ ] Implement `SecurityPipeline.ts` (refactored from AgentAutonomyEngine)
- [ ] Implement Gate 1: Role Check
- [ ] Implement Gate 2: Rate Limit (with Redis or in-memory counter)
- [ ] Implement Gate 3: Spend Limit
- [ ] Implement Gate 4: Scope Boundary
- [ ] Implement Gate 5: Audit Log (write to Supabase + generate SHA-256 hash)
- [ ] Implement Gate 6: Human Override (queue action for sponsor approval)
- [ ] Implement Gate 7: Time Sandbox (check access policy expiry)
- [ ] Implement Gate 8: Reputation Gate (check tier permissions)
- [ ] Implement `POST /actions/execute` endpoint
- [ ] Implement `POST /actions/batch` endpoint
- [ ] Implement `ReputationEngine.ts` — scoring, tier transitions
- [ ] Implement `GET /reputation/:id` endpoint
- [ ] Implement `SlashingService.ts` — violation detection, bond deduction
- [ ] Implement `EventBus.ts` — internal event system
- [ ] Implement `WebhookService.ts` — event delivery to subscribers
- [ ] Implement POST/GET/DELETE `/webhooks` endpoints
- [ ] Implement `GET /events/stream` (SSE)
- [ ] Write comprehensive tests for all 8 gates
- [ ] Write load tests — target <50ms p95 for gate pipeline

**Deliverable**: Developers can register agents and submit actions through the full 8-gate pipeline. Actions are approved or blocked. Reputation changes. Violations trigger slashing. Webhooks fire.

### Phase 3: x402 + Smart Contracts (Weeks 9–12)

**Goal**: Real money flows. Bonds in USDC. Per-action payments via x402.

- [ ] Modify `AgentRegistry.sol` — USDC bonds on Base
- [ ] Modify `ReputationScore.sol` — ERC-8004 compatibility
- [ ] Modify `SlashingEngine.sol` — USDC slashing
- [ ] Create `XorbEscrow.sol` — unified escrow
- [ ] Modify `ActionVerifier.sol` (renamed from PoPTracker) — action hash anchoring
- [ ] Write Hardhat test suites for all modified contracts
- [ ] Deploy contracts to Base Sepolia testnet
- [ ] Implement `x402Middleware.ts` — payment verification for all paid endpoints
- [ ] Integrate `@x402/express` server-side middleware
- [ ] Configure pricing for all endpoints (per Section 9)
- [ ] Implement bond deposit flow (register agent → x402 payment → on-chain bond)
- [ ] Implement slash flow (violation detected → SlashingEngine → USDC returned to sponsor)
- [ ] Implement audit hash anchoring (action completed → hash written to ActionVerifier)
- [ ] Test full flow: register → bond → action → gate check → x402 payment → audit → slash
- [ ] Deploy contracts to Base mainnet
- [ ] Update `contracts.ts` config with mainnet addresses

**Deliverable**: Full economic loop working. Agents bonded in USDC. Actions cost USDC via x402. Violations slash USDC bonds. Audit hashes anchored on-chain.

### Phase 4: SDK + Marketplace + MCP (Weeks 13–16)

**Goal**: Developer experience polish. Marketplace live. MCP integration.

- [ ] Build `xorb-sdk-ts` — TypeScript SDK with x402 client
- [ ] Build `xorb-sdk-py` — Python SDK
- [ ] Publish `@xorb/sdk` to npm
- [ ] Publish `xorb-sdk` to PyPI
- [ ] Implement marketplace endpoints (list, browse, hire, complete, dispute, rate)
- [ ] Implement `EscrowService.ts` — marketplace escrow management
- [ ] Implement `AgentMarketplace.sol` integration
- [ ] Implement `PaymentStreaming.sol` integration
- [ ] Build `xorb-mcp` — MCP server for security gating
- [ ] Publish `xorb-mcp` to npm
- [ ] Write SDK documentation with code examples
- [ ] Write MCP integration guide
- [ ] Build `xorb-dashboard` — minimal React dashboard
  - [ ] Overview page (metrics)
  - [ ] Agent list + detail pages
  - [ ] Action log with gate results
  - [ ] Marketplace view
  - [ ] Webhook management
  - [ ] Billing/payment history
- [ ] Deploy dashboard to `dashboard.xorb.xyz`

**Deliverable**: Developers can use Xorb via SDK (TS/Python), MCP, or raw API. Marketplace is live. Dashboard provides visibility.

### Phase 5: Compliance, Docs, Launch (Weeks 17–20)

**Goal**: Production hardening. Compliance reports. Public launch.

- [ ] Implement `ComplianceReporter.ts` — EU AI Act, NIST, SOC 2 report generation
- [ ] Implement `GET /audit/:id/report` endpoint with format options
- [ ] Implement ERC-8004 compatibility layer
  - [ ] Agent registration emits ERC-8004 compatible metadata
  - [ ] Reputation feedback stored as ERC-8004 attestations
  - [ ] Cross-platform reputation queries
- [ ] Write full API documentation (OpenAPI/Swagger spec)
- [ ] Build `docs.xorb.xyz` documentation site
  - [ ] Getting Started guide
  - [ ] 8-Gate Pipeline explained
  - [ ] API Reference (auto-generated from OpenAPI)
  - [ ] SDK guides (TypeScript, Python)
  - [ ] MCP integration guide
  - [ ] Smart contract addresses and ABIs
  - [ ] x402 payment guide
  - [ ] Webhook event reference
  - [ ] Compliance reporting guide
- [ ] Security audit of smart contracts (at minimum, internal review + Slither/Mythril)
- [ ] Penetration testing of API endpoints
- [ ] Rate limiting hardening
- [ ] Error handling audit — ensure no internal state leaks
- [ ] Set up monitoring (Datadog/Grafana)
- [ ] Set up alerting (PagerDuty/Opsgenie)
- [ ] Launch blog post
- [ ] Product Hunt launch
- [ ] Hacker News Show HN post
- [ ] Twitter/X announcement
- [ ] Reach out to 10 AI agent teams for beta testing

**Deliverable**: Xorb is publicly available. Documentation is complete. Compliance reports are exportable. ERC-8004 compatible. Monitoring and alerting in place.

---

## 14. Business Model & Pricing

### Revenue Streams

| Stream | Pricing | Volume Assumption (Year 1) | Annual Revenue |
|--------|---------|---------------------------|----------------|
| Per-action gate checks | $0.005/action | 1,000 agents × 100 actions/day × 365 | $182,500 |
| Agent registration | $0.10/agent | 5,000 agents | $500 |
| Reputation lookups | $0.001/lookup | 500,000 lookups | $500 |
| Marketplace fees | 2% of escrow | $500,000 total escrow volume | $10,000 |
| Compliance reports | $1.00/report | 2,000 reports | $2,000 |
| Webhook subscriptions | $0.10/month | 500 subscriptions × 12 months | $600 |
| Bond custody yield | 4% APY on escrowed USDC | $250,000 avg escrow balance | $10,000 |
| Enterprise tier | $2,000–$10,000/month | 5 enterprise customers | $120,000–$600,000 |

**Conservative Year 1**: ~$200K–$400K
**Optimistic Year 1**: $600K+ (if enterprise tier lands)

### Free Tier

- 1,000 gate checks/month
- 5 agents
- Basic reputation queries
- Health + status endpoints
- Emergency controls always free

### Growth Tier (Pay-per-use via x402)

- Unlimited gate checks ($0.005/each)
- Unlimited agents ($0.10 registration each)
- Full API access
- Webhook subscriptions
- Compliance reports

### Enterprise Tier

- Self-hosted deployment option
- Custom SLA (99.9% uptime)
- Dedicated support
- Custom gate configurations
- Private smart contract deployment
- SOC 2 compliance documentation
- $2,000–$10,000/month

---

## 15. Go-To-Market Strategy

### Target Users (In Priority Order)

1. **AI agent framework builders** — Teams building on LangChain, CrewAI, AutoGen, OpenClaw who need security and accountability for their deployed agents.
2. **Crypto-native agent platforms** — Projects deploying agents that transact on-chain and need identity, reputation, and economic accountability.
3. **Enterprise AI teams** — Companies deploying autonomous agents in production who need compliance documentation and audit trails.

### Launch Channels

| Channel | Action | Timeline |
|---------|--------|----------|
| Hacker News | Show HN post with working demo | Week 20 |
| Product Hunt | Full launch with SDK + docs | Week 20 |
| Twitter/X | Thread explaining the 8-gate pipeline | Week 18+ |
| Dev.to / Medium | Technical blog post series | Week 18+ |
| GitHub | Open-source the SDK and MCP server | Week 16 |
| Discord | Xorb community server | Week 17 |
| Direct outreach | Email 50 AI agent teams | Week 19 |
| x402 ecosystem | List on x402.org partner page | Week 13 |
| ERC-8004 ecosystem | Contribute to standard, list as implementation | Week 17 |

### First 10 Customers Strategy

- Identify 50 teams building AI agents (from YC batches, GitHub trending, Twitter)
- Offer free enterprise tier for 3 months in exchange for feedback
- Focus on teams already using x402 or MCP
- Document case studies from first 3 customers

---

## 16. Success Metrics

### Month 1 Post-Launch

- [ ] 50+ registered developers
- [ ] 200+ agents registered
- [ ] 10,000+ gate checks processed
- [ ] 3+ teams actively using SDK
- [ ] $500+ in x402 revenue

### Month 3 Post-Launch

- [ ] 200+ registered developers
- [ ] 1,000+ agents registered
- [ ] 100,000+ gate checks processed
- [ ] 10+ teams actively using SDK
- [ ] 1+ enterprise customer in pipeline
- [ ] $5,000+ monthly x402 revenue

### Month 6 Post-Launch

- [ ] 500+ registered developers
- [ ] 5,000+ agents registered
- [ ] 1,000,000+ gate checks processed
- [ ] 1+ compliance report exported by a paying customer
- [ ] 1+ enterprise customer paying
- [ ] $20,000+ monthly revenue

---

## 17. Final Directory Structure

```
xorb/
├── xorb-api/                       # Core API server
│   ├── src/
│   │   ├── index.ts
│   │   ├── middleware/
│   │   │   ├── SecurityPipeline.ts
│   │   │   ├── x402Middleware.ts
│   │   │   ├── rateLimiter.ts
│   │   │   ├── auth.ts
│   │   │   └── cors.ts
│   │   ├── routes/
│   │   │   ├── agents.ts
│   │   │   ├── actions.ts
│   │   │   ├── reputation.ts
│   │   │   ├── marketplace.ts
│   │   │   ├── audit.ts
│   │   │   ├── webhooks.ts
│   │   │   ├── events.ts
│   │   │   └── health.ts
│   │   ├── services/
│   │   │   ├── AgentRegistry.ts
│   │   │   ├── AgentRoles.ts
│   │   │   ├── AgentIdentity.ts
│   │   │   ├── ReputationEngine.ts
│   │   │   ├── SlashingService.ts
│   │   │   ├── EscrowService.ts
│   │   │   ├── AuditService.ts
│   │   │   ├── ComplianceReporter.ts
│   │   │   ├── WebhookService.ts
│   │   │   └── EventBus.ts
│   │   ├── models/
│   │   ├── config/
│   │   └── lib/
│   ├── tests/
│   ├── Dockerfile
│   └── package.json
│
├── xorb-contracts/                  # Smart contracts (Solidity)
│   ├── contracts/
│   │   ├── AgentRegistry.sol
│   │   ├── ReputationScore.sol
│   │   ├── SlashingEngine.sol
│   │   ├── ActionVerifier.sol
│   │   ├── PaymentStreaming.sol
│   │   ├── AgentMarketplace.sol
│   │   └── XorbEscrow.sol
│   ├── test/
│   ├── scripts/
│   │   └── deploy-xorb.js
│   └── hardhat.config.ts
│
├── xorb-sdk-ts/                     # TypeScript SDK
│   ├── src/
│   └── package.json
│
├── xorb-sdk-py/                     # Python SDK
│   ├── xorb/
│   └── setup.py
│
├── xorb-mcp/                        # MCP security middleware
│   ├── src/
│   └── package.json
│
├── xorb-dashboard/                  # Minimal developer dashboard
│   ├── src/
│   └── package.json
│
├── xorb-db/                         # Supabase schema + migrations
│   ├── migrations/
│   ├── seed/
│   └── functions/
│
├── xorb-docs/                       # Documentation site
│   ├── docs/
│   └── docusaurus.config.js
│
├── xorb-deploy/                     # CI/CD, env configs
│   ├── .github/workflows/
│   ├── docker-compose.yml
│   └── fly.toml
│
├── README.md
├── LICENSE
└── .gitignore
```

---

## Core Insight

SylOS already built the hard parts (8-gate pipeline, reputation system, agent identity, bonding/slashing, marketplace escrow). The transformation is about stripping away the desktop OS metaphor and token economics, rewiring everything as an API, plugging in x402 for payments, and shipping it to the AI agent developer community.

**Start with Phase 1. Ship the API. Get 3 teams using it. Everything else follows.**
