# Service Level Agreement

**Provider:** Fintex Australia Pty Ltd (ACN 688 406 108), trading as X.orb
**Effective Date:** 2026-03-18
**Version:** 1.0

---

## 1. Overview

This Service Level Agreement (SLA) defines the availability commitments, measurement methodology, incident response times, and remedies for the X.orb API and platform services. This SLA applies to the X.orb REST API (`api.xorb.xyz`), dashboard (`dashboard.xorb.xyz`), and associated Supabase Edge Functions.

This SLA does not cover third-party dependencies that are outside X.orb's control, including the Polygon PoS network, USDC smart contract operations, or end-user internet connectivity.

---

## 2. Service Tiers

### 2.1 Free Tier

| Attribute | Value |
|-----------|-------|
| Monthly API Calls | 1,000 |
| Uptime Commitment | None (best effort) |
| Support Channel | Community forum, GitHub Issues |
| Response Time | No guaranteed response time |
| Financial Remedy | None |

The Free Tier is provided as-is for evaluation and development purposes. X.orb makes reasonable efforts to maintain availability but provides no uptime guarantee. Free Tier usage may be deprioritized during capacity constraints.

### 2.2 Pro Tier

| Attribute | Value |
|-----------|-------|
| Monthly API Calls | 100,000 (additional calls billed via x402 at standard rates) |
| Uptime Commitment | 99.5% monthly |
| Support Channel | Email (support@xorb.xyz), priority GitHub Issues |
| Response Time | See Section 4 (Incident Response) |
| Financial Remedy | Service credits (see Section 5) |

### 2.3 Enterprise Tier

| Attribute | Value |
|-----------|-------|
| Monthly API Calls | Unlimited (subject to agreed rate limits) |
| Uptime Commitment | 99.9% monthly |
| Support Channel | Dedicated Slack channel, email, phone |
| Response Time | See Section 4 (Incident Response) |
| Financial Remedy | Service credits and contractual penalties (see Section 5) |
| Additional | Custom rate limits, dedicated support engineer, quarterly business reviews |

---

## 3. Uptime Measurement

### 3.1 Definition of Uptime

**Uptime** is measured as the percentage of time the X.orb API (`api.xorb.xyz`) successfully responds to health check requests (`GET /v1/health`) with an HTTP 200 status code within 5 seconds.

```
Monthly Uptime % = ((Total Minutes in Month - Downtime Minutes) / Total Minutes in Month) * 100
```

### 3.2 What Counts as Downtime

A minute is counted as "down" if more than 50% of health check requests within that minute fail or exceed the 5-second timeout. Health checks are performed every 30 seconds from at least two independent monitoring locations.

### 3.3 Excluded from Downtime Calculation

The following are **not** counted as downtime:

- **Scheduled Maintenance:** Pre-announced maintenance windows with at least 72 hours notice to affected customers. Scheduled maintenance will not exceed 4 hours per month and will be performed during low-traffic hours (02:00-06:00 AEST).
- **Force Majeure:** Natural disasters, government actions, wars, pandemics, or other events beyond X.orb's reasonable control.
- **Third-Party Outages:** Downtime caused by Polygon PoS network congestion or outages, USDC contract issues, or Supabase/Vercel platform outages that are outside X.orb's control (provided X.orb executes its failover procedures within documented timeframes).
- **Customer-Caused Issues:** Downtime resulting from the customer's own infrastructure, misconfiguration, or actions that violate the acceptable use policy.
- **API Rate Limiting:** HTTP 429 responses due to customers exceeding their rate limits are not considered downtime.
- **x402 Payment Responses:** HTTP 402 responses for exhausted free-tier quotas are not considered downtime; they are the expected behavior of the payment middleware.

### 3.4 Uptime Targets in Context

| Tier | Monthly Uptime | Allowed Downtime per Month | Allowed Downtime per Year |
|------|---------------|---------------------------|--------------------------|
| Free | Best effort | N/A | N/A |
| Pro | 99.5% | ~3 hours 39 minutes | ~1 day 19 hours |
| Enterprise | 99.9% | ~43 minutes | ~8 hours 46 minutes |

---

## 4. Incident Response Times

### 4.1 Severity Definitions

| Severity | Definition | Examples |
|----------|-----------|----------|
| P1 — Critical | Complete service outage affecting all customers; data breach or security compromise; financial loss occurring | API returning 5xx to all requests; database credentials leaked; funds drained from smart contracts |
| P2 — Major | Significant degradation affecting >25% of requests or a major feature is completely unavailable | Pipeline processing failing for a subset of agents; webhook delivery completely broken; dashboard inaccessible |
| P3 — Minor | Limited impact; workaround available; single feature degraded but core pipeline operational | Reputation decay cron job failing; single API endpoint returning errors; dashboard chart not loading |
| P4 — Low | Cosmetic issues, documentation errors, minor inconveniences with no impact on core functionality | Typo in API error message; dashboard styling glitch; non-critical log noise |

### 4.2 Response Time Commitments

| Severity | Free Tier | Pro Tier | Enterprise Tier |
|----------|-----------|----------|-----------------|
| P1 — Critical | Best effort | 1 hour (acknowledge), 4 hours (update) | 15 minutes (acknowledge), 1 hour (update), 4 hours (resolution or mitigation) |
| P2 — Major | Best effort | 4 hours (acknowledge), 1 business day (update) | 30 minutes (acknowledge), 4 hours (update), 8 hours (resolution or mitigation) |
| P3 — Minor | Best effort | 1 business day (acknowledge) | 4 hours (acknowledge), 1 business day (update) |
| P4 — Low | Best effort | 3 business days (acknowledge) | 1 business day (acknowledge) |

**Acknowledge** means X.orb has confirmed receipt of the incident report and assigned it to an engineer.
**Update** means the customer receives a substantive status update with diagnosis progress.
**Resolution or mitigation** means the issue is either fixed or a workaround is in place that restores service.

### 4.3 Business Hours

- **Pro Tier:** Business hours are Monday-Friday, 09:00-18:00 AEST (UTC+10/+11), excluding Australian public holidays.
- **Enterprise Tier:** P1 and P2 incidents are covered 24/7/365. P3 and P4 follow business hours.

---

## 5. Remedies and Service Credits

### 5.1 Pro Tier Service Credits

If X.orb fails to meet the 99.5% monthly uptime commitment for Pro Tier customers:

| Monthly Uptime | Service Credit (% of monthly fee) |
|---------------|----------------------------------|
| 99.0% - 99.49% | 10% |
| 95.0% - 98.99% | 25% |
| 90.0% - 94.99% | 50% |
| Below 90.0% | 100% |

Service credits are applied to the next billing cycle. Credits do not accumulate beyond 100% of one month's fee. Credits must be requested within 30 days of the affected month.

### 5.2 Enterprise Tier Financial Penalties

Enterprise agreements include contractual financial penalties in addition to service credits:

| Monthly Uptime | Service Credit | Financial Penalty |
|---------------|---------------|-------------------|
| 99.5% - 99.89% | 10% of monthly fee | None |
| 99.0% - 99.49% | 25% of monthly fee | 5% of annual contract value (prorated monthly) |
| 95.0% - 98.99% | 50% of monthly fee | 10% of annual contract value (prorated monthly) |
| Below 95.0% | 100% of monthly fee | 15% of annual contract value (prorated monthly) |
| 3 consecutive months below 99.9% | 100% of monthly fee | Customer may terminate contract without penalty |

Financial penalties are capped at 30% of the annual contract value in any 12-month rolling period.

### 5.3 How to Claim

1. Email support@xorb.xyz with subject line: "SLA Credit Request - [Month/Year]"
2. Include your account ID, the affected time period, and a description of the impact
3. X.orb will validate the claim against monitoring data within 5 business days
4. Approved credits are applied to the next invoice; financial penalties are paid within 30 days

---

## 6. Customer Obligations

To be eligible for SLA commitments and remedies, customers must:

1. Use the X.orb API in accordance with the published API documentation and rate limits
2. Implement reasonable retry logic with exponential backoff for transient errors
3. Report incidents promptly via the designated support channel
4. Maintain valid API keys and rotate them according to published security guidelines
5. Not engage in activities that constitute abuse, including intentional overloading of the API

---

## 7. Monitoring and Transparency

X.orb publishes real-time and historical uptime data at **status.xorb.xyz**. This status page includes:

- Current operational status of all services (API, dashboard, Supabase, on-chain)
- Incident history with timestamps and resolution details
- Scheduled maintenance announcements
- 90-day uptime history per service

Enterprise customers receive a monthly SLA compliance report as part of their quarterly business review.

---

## 8. SLA Modifications

X.orb may modify this SLA with 30 days written notice to affected customers. Modifications that reduce uptime commitments or increase response times will not apply to existing Enterprise contracts until their renewal date.

---

## 9. Governing Law

This SLA is governed by the laws of New South Wales, Australia. Any disputes arising under this SLA shall be resolved in the courts of New South Wales.

---

**Contact:** support@xorb.xyz | https://xorb.xyz
**Company:** Fintex Australia Pty Ltd, ACN 688 406 108, Sydney, Australia
