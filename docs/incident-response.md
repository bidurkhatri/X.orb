# Incident Response Runbook

**Owner:** Fintex Australia Pty Ltd (ACN 688 406 108), trading as X.orb
**Incident Commander:** Bidur Khatri, Founder
**Last Updated:** 2026-03-18
**Review Cycle:** Quarterly

---

## 1. Severity Levels

### P1 — Critical

**Definition:** Complete service outage affecting all customers, active security breach, or confirmed financial loss.

**Examples:**
- API returns 5xx errors to 100% of requests
- Supabase database is unreachable and no fallback is available
- Smart contract funds are being drained by an unauthorized party
- API keys or database credentials are confirmed leaked publicly
- Data breach affecting customer PII or agent data

**Response Expectations:**
- Acknowledge within 15 minutes (Enterprise) / 1 hour (Pro)
- All-hands engineering response
- Status page updated within 20 minutes
- Customer communication within 30 minutes
- Resolution or mitigation within 4 hours

### P2 — Major

**Definition:** Significant degradation affecting more than 25% of requests, or a major feature is completely unavailable while the core API remains operational.

**Examples:**
- Pipeline processing is failing for a subset of agents (specific gates returning errors)
- Webhook delivery system is completely down
- Dashboard is inaccessible but API is operational
- Reputation decay cron is failing, causing score drift
- x402 payment validation is rejecting valid payments

**Response Expectations:**
- Acknowledge within 30 minutes (Enterprise) / 4 hours (Pro)
- Dedicated engineer assigned
- Status page updated within 1 hour
- Resolution or mitigation within 8 hours

### P3 — Minor

**Definition:** Limited impact with a workaround available. A single feature is degraded but the core 8-gate pipeline and agent operations continue to function.

**Examples:**
- A single non-critical API endpoint returning errors
- Dashboard charts or analytics not rendering
- Audit hash chain has a gap but new records are being created correctly
- Slow response times (>2s) on a subset of endpoints
- Email notifications delayed but not lost

**Response Expectations:**
- Acknowledge within 4 hours (Enterprise) / 1 business day (Pro)
- Tracked in issue tracker, scheduled for next sprint
- Resolution within 5 business days

### P4 — Low

**Definition:** Cosmetic issues, documentation errors, or minor inconveniences with no impact on functionality.

**Examples:**
- Typo in API error message or documentation
- Dashboard styling inconsistency
- Non-critical warning in server logs
- Minor performance improvement opportunity

**Response Expectations:**
- Acknowledge within 1 business day (Enterprise) / 3 business days (Pro)
- Added to backlog
- Resolution in next planned release

---

## 2. Escalation Paths

### 2.1 Escalation Matrix

```
Detection (automated alert or customer report)
    │
    ▼
On-Call Engineer (first responder)
    │
    ├── P3/P4: Handle directly, update ticket
    │
    ├── P2: Escalate to Engineering Lead within 30 minutes if no progress
    │       │
    │       ▼
    │   Engineering Lead
    │       │
    │       └── Escalate to Incident Commander if no resolution within 4 hours
    │
    └── P1: Immediately escalate to Incident Commander
            │
            ▼
        Incident Commander (Bidur Khatri)
            │
            ├── Coordinates all response activities
            ├── Authorizes emergency changes (key rotation, contract pausing)
            ├── Manages customer and public communication
            │
            └── If security breach: Engage external security advisor
```

### 2.2 Contact Directory

| Role | Name | Contact | Availability |
|------|------|---------|-------------|
| Incident Commander | Bidur Khatri | bidur@xorb.xyz, +61-XXX-XXX-XXX | 24/7 for P1 |
| Engineering Lead | TBD | eng-lead@xorb.xyz | Business hours + P1/P2 on-call |
| On-Call Engineer | Rotation | oncall@xorb.xyz (PagerDuty) | 24/7 |
| Supabase Support | N/A | https://supabase.com/support | Per Supabase SLA |
| Vercel Support | N/A | https://vercel.com/support | Per Vercel SLA |

### 2.3 When to Escalate

Escalate to the next level if:
- The incident severity is higher than you can handle alone
- No progress has been made within 50% of the target resolution time
- The root cause involves infrastructure you do not have access to (Supabase admin, Vercel settings, contract admin keys)
- The incident involves potential data breach, financial loss, or legal exposure
- You are unsure about the appropriate response

---

## 3. Incident Response Process

### 3.1 Phase 1: Detection and Triage (0-15 minutes)

1. **Confirm the incident is real.** Check monitoring dashboards, not just a single alert.
   - Vercel Function logs: `vercel logs --follow`
   - Supabase Dashboard: Database health, connection pool usage
   - Status pages: status.supabase.com, vercel-status.com, status.polygon.technology

2. **Classify severity** using the definitions in Section 1.

3. **Open an incident channel.** Create a dedicated thread in the team communication tool (Slack, Discord, etc.) named `#incident-YYYY-MM-DD-brief-description`.

4. **Assign roles:**
   - **Incident Commander:** Makes decisions, coordinates response, manages communication
   - **Technical Lead:** Diagnoses and fixes the issue
   - **Communications Lead:** Updates status page, notifies customers

### 3.2 Phase 2: Containment (15 minutes - 1 hour)

Goal: Stop the bleeding. Prevent the incident from getting worse.

**Actions by incident type:**

| Incident Type | Containment Action |
|--------------|-------------------|
| API outage | Check Vercel deployment status; redeploy from last known-good commit if needed |
| Database outage | Verify Supabase status; API will return 503 for DB-dependent routes |
| Security breach | Rotate compromised credentials immediately (see `docs/key-rotation.md`); pause affected contracts if needed |
| Data corruption | Stop writes to affected tables via RLS policy update; preserve current state before attempting recovery |
| Contract exploit | Pause contracts from admin wallet; alert Polygon security if large-scale |

### 3.3 Phase 3: Resolution (1 hour - target resolution time)

1. **Diagnose root cause.** Use logs, metrics, and database queries to identify what failed and why.

2. **Implement fix.** This may be:
   - A code fix deployed via Vercel
   - A configuration change (env vars, Supabase settings)
   - A database migration or data repair
   - A contract interaction (pause/unpause, role change)
   - Waiting for a third-party provider to resolve their outage

3. **Verify the fix.** Run the verification steps appropriate to the incident:
   ```bash
   # API health
   curl https://api.xorb.xyz/v1/health

   # Pipeline test
   curl -X POST https://api.xorb.xyz/v1/actions \
     -H "Authorization: Bearer $TEST_KEY" \
     -H "Content-Type: application/json" \
     -d '{"agent_id": "test-agent", "action_type": "test", "payload": {}}'

   # Database connectivity
   # (check via Supabase dashboard or direct query)
   ```

4. **Monitor for recurrence.** Watch logs and metrics for 30 minutes after the fix is deployed.

### 3.4 Phase 4: Communication

**During the incident:**
- Update the status page (status.xorb.xyz) every 30 minutes for P1, every hour for P2
- Enterprise customers receive direct notification via their dedicated Slack channel
- Pro customers receive email notification for P1 and P2 incidents

**After resolution:**
- Update status page to "Resolved"
- Send resolution notification to affected customers
- Schedule post-mortem within 48 hours

---

## 4. Communication Templates

### 4.1 Initial Incident Notification

**Subject:** X.orb Service Incident - [Brief Description]

```
Status: Investigating
Severity: [P1/P2/P3]
Impact: [Description of what is affected]
Start Time: [YYYY-MM-DD HH:MM UTC]

We are aware of [brief description of the issue] affecting [scope of impact].
Our engineering team is actively investigating.

We will provide updates every [30 minutes / 1 hour] until the issue is resolved.

— X.orb Engineering Team
```

### 4.2 Status Update

**Subject:** X.orb Service Incident Update - [Brief Description]

```
Status: [Investigating / Identified / Monitoring / Resolved]
Severity: [P1/P2/P3]
Duration: [X hours Y minutes so far]

Update: [What we've learned since the last update]

Current actions: [What we're doing right now]

Estimated resolution: [Time estimate if known, or "We are continuing to investigate"]

— X.orb Engineering Team
```

### 4.3 Resolution Notification

**Subject:** X.orb Service Incident Resolved - [Brief Description]

```
Status: Resolved
Severity: [P1/P2/P3]
Duration: [Total duration]
Start: [YYYY-MM-DD HH:MM UTC]
End: [YYYY-MM-DD HH:MM UTC]

Summary: [1-2 sentence summary of what happened and what was done to fix it]

Impact: [What customers experienced during the incident]

Next steps: A detailed post-mortem will be published within 5 business days.

We apologize for the disruption. If you have questions or experienced issues
not covered by this notification, contact support@xorb.xyz.

— X.orb Engineering Team
```

### 4.4 Data Breach Notification (P1 Security)

**Subject:** X.orb Security Incident Notification

```
Dear [Customer],

We are writing to inform you of a security incident that may affect your data.

What happened: [Factual description of the breach]

When it happened: [Date range]

What data was affected: [Specific data types — API keys, agent metadata, etc.]

What we have done:
- [Immediate containment actions taken]
- [Key rotations performed]
- [Law enforcement / regulatory notifications made]

What you should do:
- Rotate your API keys immediately using POST /v1/auth/keys/rotate
- Review your agent action logs for unauthorized activity
- [Any other customer-specific actions]

We take this incident seriously and are committed to transparency.
A full post-mortem will be shared within 5 business days.

Contact: security@xorb.xyz for questions about this incident.

Bidur Khatri
Founder, X.orb
Fintex Australia Pty Ltd
```

---

## 5. Post-Mortem Template

Every P1 and P2 incident requires a post-mortem. P3 incidents require a post-mortem if they recur within 30 days.

```markdown
# Post-Mortem: [Incident Title]

**Date:** [YYYY-MM-DD]
**Severity:** [P1/P2/P3]
**Duration:** [Start time] to [End time] ([total duration])
**Author:** [Name]
**Participants:** [Names of all responders]

## Summary

[2-3 sentence summary of what happened, the impact, and the resolution]

## Timeline (all times in UTC)

| Time | Event |
|------|-------|
| HH:MM | [First detection — how was it detected?] |
| HH:MM | [Triage — who responded, severity assigned] |
| HH:MM | [Key diagnostic findings] |
| HH:MM | [Containment action taken] |
| HH:MM | [Fix deployed / mitigation applied] |
| HH:MM | [Verification — confirmed resolution] |
| HH:MM | [Monitoring period ended, incident closed] |

## Root Cause

[Detailed technical explanation of what caused the incident]

## Impact

- **Users affected:** [Number or percentage]
- **Duration of impact:** [How long users experienced degradation]
- **Data impact:** [Any data loss, corruption, or exposure]
- **Financial impact:** [Revenue lost, SLA credits owed, penalties]

## What Went Well

- [Things that worked during the response]
- [Effective processes or tools]

## What Went Poorly

- [Things that slowed down detection or response]
- [Missing runbooks, unclear ownership, tool gaps]

## Action Items

| Action | Owner | Priority | Due Date |
|--------|-------|----------|----------|
| [Specific remediation action] | [Name] | [P1-P4] | [Date] |
| [Process improvement] | [Name] | [P1-P4] | [Date] |
| [Monitoring improvement] | [Name] | [P1-P4] | [Date] |

## Lessons Learned

[Key takeaways that should inform future incident response and system design]
```

---

## 6. Service-Specific Runbooks

### 6.1 Supabase Down

**Detection:** API returns 503 on database-dependent endpoints; Supabase dashboard is inaccessible; alerts from Supabase status page.

**Immediate Actions:**
1. Check https://status.supabase.com/ to confirm it is a Supabase-side issue
2. Check Supabase Dashboard > Project > Database for connection pool exhaustion (this is an X.orb-side issue, not a Supabase outage)
3. If confirmed Supabase outage:
   - Update X.orb status page
   - The API will automatically return `503 Service Unavailable` with a descriptive message for all DB-dependent routes
   - On-chain operations continue to work via direct contract interaction
   - Cached API key validations will continue to work for up to 5 minutes

**If connection pool exhaustion (X.orb-side):**
1. Check for runaway queries: Supabase Dashboard > Database > Query Performance
2. Kill long-running queries if found
3. Check if a recent deployment introduced an N+1 query or missing connection release
4. Restart the connection pool by redeploying the API: `vercel --prod --cwd apps/api`

**Recovery verification:**
```bash
curl https://api.xorb.xyz/v1/health
# Should return {"status":"ok","database":"connected",...}

curl -H "Authorization: Bearer $API_KEY" https://api.xorb.xyz/v1/agents
# Should return agent list, not 503
```

### 6.2 Vercel Down

**Detection:** API and dashboard are unreachable; Vercel status page shows incident.

**Immediate Actions:**
1. Check https://www.vercel-status.com/
2. If confirmed Vercel outage:
   - Update X.orb status page
   - Smart contracts remain fully operational on Polygon
   - Supabase Edge Functions remain operational (independent infrastructure)
   - Notify Enterprise customers with estimated impact

**If outage exceeds 4 hours — Failover to Cloudflare Workers:**
1. The API uses Hono, which natively supports Cloudflare Workers
2. Deploy:
   ```bash
   cd apps/api
   # Create wrangler.toml if not already present
   wrangler deploy
   ```
3. Update DNS:
   - Change `api.xorb.xyz` CNAME to point to the Cloudflare Worker
   - DNS TTL should already be 300s (5 minutes) for fast propagation
4. Verify the Cloudflare deployment with the same health check endpoints

**Recovery after Vercel restores:**
1. Verify Vercel deployment is healthy
2. Switch DNS back to Vercel
3. Monitor for 30 minutes
4. Update status page

### 6.3 Polygon PoS Down / Congested

**Detection:** On-chain transactions are failing or taking >5 minutes to confirm; RPC calls timing out; Polygon status page shows issues.

**Immediate Actions:**
1. Check https://status.polygon.technology/
2. If Polygon is down or severely congested:
   - All X.orb API operations that are purely off-chain (pipeline processing, reputation queries, API key management) continue to work normally
   - Only affected: staking, slashing execution, escrow operations, and any action that requires on-chain confirmation
   - Queue on-chain operations for retry rather than failing immediately

**If RPC provider (Infura/Alchemy) is down but Polygon is healthy:**
1. Switch to a public RPC endpoint temporarily:
   ```bash
   # Update POLYGON_RPC_URL in Vercel
   vercel env rm POLYGON_RPC_URL production --yes
   vercel env add POLYGON_RPC_URL production
   # Use: https://polygon-rpc.com/ (public, rate-limited)
   vercel --prod --cwd apps/api
   ```
2. Monitor rate limits on public endpoint
3. Switch back to the paid provider when it recovers

**Recovery verification:**
```bash
# Verify RPC connectivity
cast block-number --rpc-url https://polygon-rpc.com/

# Verify contract readability
cast call 0x2a7457C2f30F9C0Bb47b62ed8554C75d13BF9ec7 \
  "name()" --rpc-url https://polygon-rpc.com/
```

### 6.4 Data Breach

**Detection:** Unauthorized access to customer data, leaked credentials, suspicious database queries, or external notification of data exposure.

**This is always a P1 incident. Escalate immediately to Incident Commander.**

**Immediate Actions (first 30 minutes):**

1. **Contain the breach:**
   - If API keys leaked: deactivate all affected keys in `api_keys` table (`UPDATE api_keys SET is_active = false WHERE ...`)
   - If Supabase credentials leaked: rotate immediately per `docs/key-rotation.md`
   - If deployer key leaked: pause all contracts, revoke roles, rotate key
   - If unauthorized database access: revoke the compromised credential, review RLS policies

2. **Preserve evidence:**
   - Export Supabase query logs for the affected time period
   - Export Vercel function logs
   - Screenshot any external evidence (paste sites, forums, dark web mentions)
   - Do NOT modify or delete logs

3. **Assess scope:**
   - Which tables were accessed?
   - Which customer data was exposed?
   - Was any data modified or deleted?
   - How long did the unauthorized access last?

**Within 24 hours:**

4. **Notify affected parties:**
   - Use the Data Breach Notification template (Section 4.4)
   - Notify Enterprise customers individually via their dedicated channel
   - Notify Pro customers via email

5. **Regulatory obligations:**
   - Under Australian Privacy Act 1988 (Notifiable Data Breaches scheme), if the breach involves personal information and is likely to result in serious harm, notify the Office of the Australian Information Commissioner (OAIC) within 30 days
   - OAIC notification portal: https://www.oaic.gov.au/privacy/notifiable-data-breaches
   - If EU/UK customers are affected, GDPR requires notification within 72 hours

6. **Engage external support if needed:**
   - Cybersecurity incident response firm
   - Legal counsel for regulatory compliance
   - Law enforcement if criminal activity is suspected

**Within 5 business days:**

7. Complete and publish post-mortem (internal and customer-facing versions)
8. Implement all immediate remediation actions from the post-mortem
9. Schedule a security review of all access controls, RLS policies, and key management procedures

---

## 7. Monitoring and Alerting Setup

To support effective incident detection, the following monitoring should be in place:

| Monitor | Tool | Alert Threshold | Alert Channel |
|---------|------|----------------|---------------|
| API health check | UptimeRobot / Better Uptime | 2 consecutive failures (60s) | PagerDuty (P1), Slack (P2+) |
| API error rate | Vercel Analytics | >5% of requests returning 5xx over 5 minutes | PagerDuty (P1), Slack (P2) |
| API response time | Vercel Analytics | p95 >3s over 5 minutes | Slack (P3) |
| Database connections | Supabase Dashboard | >80% pool utilization | Slack (P2) |
| Supabase status | StatusPage webhook | Any incident on status.supabase.com | Slack (P2) |
| Vercel status | StatusPage webhook | Any incident on vercel-status.com | Slack (P2) |
| Polygon block production | Custom script | No new blocks for >30s | Slack (P3) |
| Contract events | On-chain listener | Unexpected `Paused`, `RoleGranted`, or large `Transfer` events | PagerDuty (P1) |
| Cron job execution | Vercel Cron logs | Cron job failure 2+ times consecutively | Slack (P3) |

---

## 8. Incident Log

Maintain a running log of all P1 and P2 incidents. This serves as institutional memory and helps identify patterns.

| Date | Severity | Duration | Summary | Post-Mortem Link |
|------|----------|----------|---------|-----------------|
| (No incidents recorded yet) | | | | |

---

## 9. Runbook Maintenance

- This runbook is reviewed quarterly by the Incident Commander
- After every P1 or P2 incident, review and update relevant sections based on lessons learned
- All team members should read this document during onboarding and re-read it annually
- Conduct a tabletop incident simulation exercise every 6 months using a randomly selected scenario from Section 6
