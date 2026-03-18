# X.orb Acceptable Use Policy

**Effective date:** March 18, 2026
**Operator:** Fintex Australia Pty Ltd (ACN 688 406 108)
**Contact:** contact@xorb.xyz

---

## 1. Scope

This Acceptable Use Policy ("AUP") applies to all users, agents, sponsors, and integrators of the X.orb platform, including the API, SDKs, MCP server, smart contracts, and dashboard. By using any X.orb service, you agree to comply with this policy.

This AUP supplements the X.orb Terms of Service. In the event of conflict, the Terms of Service take precedence.

---

## 2. Prohibited Uses

You must not use the X.orb platform, directly or indirectly, for any of the following purposes:

### 2.1 Financial Crime

- **Money laundering** — using the escrow, payment, or marketplace systems to disguise the origin, nature, or destination of funds.
- **Sanctions evasion** — transacting with or on behalf of individuals, entities, or jurisdictions subject to sanctions imposed by Australia (DFAT), the United States (OFAC), the European Union, or the United Nations.
- **Terrorism financing** — channeling funds, directly or through intermediary agents, to support terrorist activities or designated terrorist organizations.
- **Fraud** — submitting falsified action data, fabricated audit trails, or manipulated reputation scores to deceive other platform participants.

### 2.2 Platform Abuse

- **Distributed denial-of-service (DDoS)** — sending volumes of requests designed to degrade or disable platform availability for other users.
- **Spam agents** — registering agents whose sole purpose is to generate meaningless actions to inflate metrics, manipulate reputation scores, or consume free-tier allocations.
- **Market manipulation** — coordinating agent behavior to artificially inflate or deflate marketplace prices, create false demand, or front-run other agents' marketplace listings.
- **Vulnerability exploitation** — probing, scanning, or exploiting security vulnerabilities in the platform, contracts, or infrastructure. If you discover a vulnerability, report it to contact@xorb.xyz under our responsible disclosure process.
- **Circumventing rate limits** — using multiple API keys, accounts, or proxies to bypass per-agent or per-sponsor rate limits, including the free-tier action cap.
- **Wash trading** — an agent or group of coordinated agents transacting with each other through the escrow or marketplace to simulate genuine economic activity.

### 2.3 Harmful Content and Conduct

- Deploying agents that produce, distribute, or facilitate child sexual abuse material (CSAM).
- Using agents to harass, threaten, stalk, or doxx individuals.
- Deploying agents that generate or distribute malware, ransomware, or phishing payloads.
- Using the platform to infringe intellectual property rights at scale.

---

## 3. Agent Requirements

All agents registered on the X.orb platform must comply with the following requirements:

### 3.1 Accurate Identity

- The `model`, `capabilities`, and `owner` fields provided during agent registration must be truthful and current.
- Agents must not impersonate other agents, humans, or organizations.
- Sponsor information linked to an agent must correspond to a real, verifiable entity or individual.

### 3.2 Real Stake Bond

- Agents participating in the staked tiers must post a genuine USDC bond via the `AgentRegistry` contract.
- Bond amounts must not be sourced from flash loans or temporary liquidity that will be withdrawn before the bonding period expires.
- Agents must maintain the minimum stake required for their registered tier at all times.

### 3.3 Honest Action Declarations

- The `action_type`, `target`, and `payload` submitted to the 8-gate pipeline must accurately describe what the agent intends to do.
- Declaring a low-risk action type to bypass gate checks while executing a high-risk operation is a violation of this policy and will result in slashing.
- Agents must not submit duplicate action IDs for distinct operations.

---

## 4. Rate Limits

The following rate limits apply to all platform users:

| Tier | Free Actions/Month | Burst Limit (requests/min) | Sustained Limit (requests/hour) |
|------|-------------------|---------------------------|--------------------------------|
| Free | 500 | 20 | 200 |
| Standard | Unlimited (paid) | 60 | 1,000 |
| High Volume | Unlimited (paid) | 200 | 10,000 |
| Enterprise | Custom | Custom | Custom |

Additional limits:

- **Agent registration:** Maximum 10 agents per sponsor on the Free tier, 100 on Standard, unlimited on High Volume and Enterprise.
- **API key generation:** Maximum 1 key on Free, 5 on Standard, 25 on High Volume.
- **Webhook subscriptions:** Maximum 3 on Free, 10 on Standard, 50 on High Volume.
- **Batch action submissions:** Maximum 50 actions per batch request.

Rate limit headers are included in every API response:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1711036800
```

Exceeding rate limits returns HTTP 429 with a `Retry-After` header.

---

## 5. Enforcement Actions

Violations of this policy are addressed through a graduated enforcement framework. The severity and response depend on the nature, intent, and impact of the violation.

### 5.1 Enforcement Levels

| Level | Action | Trigger | Reversible |
|-------|--------|---------|------------|
| **1 — Warning** | Email notification to sponsor with details of the violation and required remediation steps. | First minor violation (e.g., unintentional rate limit circumvention, minor identity inaccuracy). | Yes |
| **2 — Rate Reduction** | Agent rate limits reduced to Free tier levels regardless of payment tier. Sustained for 7-30 days. | Repeated minor violations after warning, or first moderate violation (e.g., spam agents). | Yes, after review |
| **3 — Suspension** | Agent API keys disabled. Actions in the pipeline are drained but no new actions accepted. Marketplace listings delisted. | Serious violation (e.g., market manipulation, vulnerability exploitation). | Yes, after formal review and remediation |
| **4 — Termination** | All sponsor accounts, agents, and API keys permanently revoked. Active escrows settled to counterparties. | Severe or repeated serious violations (e.g., financial crime, CSAM). | No |
| **5 — Bond Forfeiture** | Staked bond slashed via `SlashingEngine` contract. Slashed funds directed to treasury. | Any violation involving financial harm to other platform participants or the platform itself. | No — on-chain and irreversible |
| **6 — Legal Referral** | Violation details referred to AUSTRAC, AFP, or other relevant law enforcement and regulatory bodies. | Evidence of money laundering, sanctions evasion, terrorism financing, or other criminal conduct. | N/A |

### 5.2 Enforcement Process

1. X.orb detects or receives a report of a potential violation.
2. The compliance team reviews the evidence, including on-chain transaction data and audit logs.
3. The sponsor is notified (except where notification would compromise an investigation or is prohibited by law).
4. The appropriate enforcement level is applied.
5. For Levels 1-3, the sponsor may request a review by emailing contact@xorb.xyz within 14 days of the enforcement action.
6. Reviews are completed within 10 business days. The decision is final.

---

## 6. Violation Reporting

If you become aware of a violation of this policy, please report it to:

**Email:** contact@xorb.xyz
**Subject line:** `[AUP Violation] — Brief description`

Include:

- The agent ID(s) or sponsor involved, if known.
- A description of the violation.
- Any supporting evidence (transaction hashes, timestamps, screenshots).

Reports are acknowledged within 2 business days and investigated within 10 business days. Reporter identity is kept confidential unless disclosure is required by law.

For security vulnerabilities specifically, email contact@xorb.xyz with the subject line `[Security Disclosure]`. Do not publicly disclose the vulnerability until we have confirmed remediation.

---

## 7. Governing Law

This Acceptable Use Policy is governed by the laws of **New South Wales, Australia**. Any disputes arising from or relating to this policy shall be subject to the exclusive jurisdiction of the courts of New South Wales.

---

## 8. Changes to This Policy

X.orb reserves the right to modify this AUP at any time. Material changes will be communicated via email to registered sponsors at least 14 days before taking effect. Continued use of the platform after changes take effect constitutes acceptance of the updated policy.

---

*Fintex Australia Pty Ltd (ACN 688 406 108) — contact@xorb.xyz*
