# X.orb Privacy Policy

**Effective Date:** 18 March 2026
**Last Updated:** 18 March 2026

**Fintex Australia Pty Ltd**
ACN 688 406 108 | ABN 98 688 406 108
Sydney, New South Wales, Australia
Contact: contact@xorb.xyz
Website: https://www.xorb.xyz

---

## 1. Introduction

This Privacy Policy describes how Fintex Australia Pty Ltd ("X.orb," "we," "us," or "our") collects, uses, stores, and protects your personal information when you use the X.orb platform, API, SDKs, and related services (the "Service").

X.orb is an API-first trust infrastructure platform for autonomous AI agents. This policy applies to all users of the Service, including developers, organizations, and any individuals whose data may be processed through the Service.

We are committed to protecting your privacy in accordance with the Australian Privacy Act 1988 (Cth), the General Data Protection Regulation (EU) 2016/679 ("GDPR"), the California Consumer Privacy Act ("CCPA"), and other applicable privacy laws.

## 2. Data We Collect

### 2.1. Account and Authentication Data

| Data Type | Purpose | Retention |
|-----------|---------|-----------|
| Owner wallet address | API key ownership and agent authorization | 3 years from last activity |
| API key hash (SHA-256) | Authentication; the raw key is never stored | 3 years from last activity |
| API key label | User-defined identifier for key management | 3 years from last activity |
| API key scopes | Permission management | 3 years from last activity |

### 2.2. Agent Data

| Data Type | Purpose | Retention |
|-----------|---------|-----------|
| Agent ID | Unique identifier for registered agents | 3 years from agent creation |
| Agent name and description | User-defined metadata | 3 years from agent creation |
| Agent role | Access control and compliance | 3 years from agent creation |
| Sponsor address | Ownership verification | 3 years from agent creation |
| Session wallet address | Derived wallet for agent operations | 3 years from agent creation |
| Stake bond amount | Economic bonding for trust | 3 years from agent creation |

### 2.3. Action and Pipeline Data

| Data Type | Purpose | Retention |
|-----------|---------|-----------|
| Action ID | Unique identifier for each pipeline execution | 3 years |
| Action type and tool | Classification and gate evaluation | 3 years |
| Action parameters | Input data submitted for pipeline processing | 3 years |
| Gate results (8 gates) | Security evaluation outcomes | 3 years |
| Audit hash | Tamper-evident integrity verification | 3 years |
| Pipeline latency | Performance monitoring | 3 years |
| Reputation delta | Score changes from actions | 3 years |

### 2.4. Technical and Operational Data

| Data Type | Purpose | Retention |
|-----------|---------|-----------|
| IP address | Rate limiting, abuse prevention, security monitoring | 90 days |
| Request ID | Request tracing and debugging | 90 days |
| User-Agent header | SDK version tracking and compatibility | 90 days |
| Request timestamp | Audit trail and billing | 3 years |
| HTTP method and path | API usage analytics | 3 years |
| Response status code | Error monitoring and debugging | 90 days |

### 2.5. Payment Data

| Data Type | Purpose | Retention |
|-----------|---------|-----------|
| Payment signatures (x402) | Payment verification | 3 years |
| Payment nonce hash | Replay attack prevention | 3 years |
| Payer wallet address | Payment attribution | 3 years |
| Payment amount (USDC) | Billing and accounting | 7 years (tax compliance) |

### 2.6. Webhook Data

| Data Type | Purpose | Retention |
|-----------|---------|-----------|
| Webhook endpoint URL | Event delivery | Until subscription deleted |
| Webhook secret (HMAC key) | Payload signature verification | Until subscription deleted |
| Delivery logs | Troubleshooting and retry management | 90 days |

### 2.7. Data We Do Not Collect

- We do not collect personal names, email addresses, phone numbers, or physical addresses through the API. The Service is wallet-address-based.
- We do not use cookies on the API. The API is stateless and authenticates solely via the `x-api-key` header.
- We do not use tracking pixels, web beacons, or third-party analytics on the API.
- We do not collect biometric data.

## 3. How We Use Your Data

We use the data we collect for the following purposes:

3.1. **Service Delivery** — To authenticate API requests, process agent registrations, execute the 8-gate security pipeline, calculate reputation scores, manage escrow transactions, and generate compliance reports.

3.2. **Security and Abuse Prevention** — To detect and prevent unauthorized access, rate limit abuse, replay attacks, and other malicious activity.

3.3. **Audit and Compliance** — To maintain tamper-evident audit trails as required by the Service's trust infrastructure, and to generate compliance reports against EU AI Act, NIST AI RMF, and SOC 2 frameworks.

3.4. **Billing and Payments** — To track free tier usage, validate x402 payments, and maintain financial records as required by Australian tax law.

3.5. **Service Improvement** — To analyze aggregate, anonymized usage patterns to improve performance, reliability, and features. We do not use your data for advertising or sell it to third parties.

3.6. **Legal Obligations** — To comply with applicable laws, regulations, court orders, or governmental requests.

## 4. Legal Basis for Processing (GDPR)

If you are in the EEA, UK, or Switzerland, we process your personal data under the following legal bases:

| Legal Basis | Data | Purpose |
|-------------|------|---------|
| Contract performance (Art. 6(1)(b)) | Account data, agent data, action data | Necessary to provide the Service |
| Legitimate interest (Art. 6(1)(f)) | IP addresses, request logs | Security, abuse prevention, service improvement |
| Legal obligation (Art. 6(1)(c)) | Payment data, audit logs | Tax compliance, regulatory requirements |
| Consent (Art. 6(1)(a)) | Webhook URLs | You actively choose to register webhooks |

## 5. Data Storage and Security

5.1. **Primary Storage.** Your data is stored in Supabase (PostgreSQL) instances hosted in secure data centers. Supabase provides SOC 2 Type II certified infrastructure.

5.2. **Encryption at Rest.** All data stored in Supabase is encrypted at rest using AES-256 encryption.

5.3. **Encryption in Transit.** All API communication is encrypted using TLS 1.2 or higher. Unencrypted HTTP connections are rejected.

5.4. **API Key Security.** Raw API keys are never stored. Only the SHA-256 hash of each key is persisted. API keys are generated using cryptographically secure random bytes and shown to the user exactly once.

5.5. **Webhook Secrets.** Webhook HMAC secrets are generated using UUID v4 and stored securely. They are returned to you once at subscription creation.

5.6. **On-Chain Data.** Certain data (stake bonds, slashing events, escrow transactions) is written to smart contracts on Polygon PoS (Chain ID 137). On-chain data is public and immutable by nature.

5.7. **Access Controls.** Access to production databases is restricted to authorized personnel using multi-factor authentication and role-based access controls.

## 6. Data Processors (Sub-processors)

We use the following third-party services to process your data:

| Processor | Purpose | Data Processed | Location |
|-----------|---------|----------------|----------|
| **Supabase Inc.** | Primary database, authentication | All API data (encrypted at rest) | United States (AWS) |
| **Vercel Inc.** | API hosting, edge compute | Request/response data in transit, logs | Global (edge network) |
| **Polygon PoS Network** | Blockchain state (smart contracts) | Stake bonds, slashing records, escrow | Decentralized |
| **Sentry** (if configured) | Error monitoring | Error messages, stack traces, request metadata | United States |

For transfers of personal data outside the EEA, we rely on Standard Contractual Clauses (SCCs) approved by the European Commission, or the data recipient's participation in an adequate transfer mechanism.

## 7. Data Retention

7.1. **Standard Retention.** Agent data, action logs, audit trails, and reputation histories are retained for three (3) years from the date of creation.

7.2. **Technical Logs.** IP addresses, request IDs, and response status codes are retained for 90 days.

7.3. **Financial Records.** Payment data is retained for seven (7) years to comply with Australian tax law (Taxation Administration Act 1953).

7.4. **On-Chain Data.** Data written to the Polygon blockchain is immutable and persists indefinitely. This includes stake bond amounts, slashing events, and escrow transactions.

7.5. **Post-Retention Deletion.** After the applicable retention period, data is permanently deleted from active databases and all backups within 90 days.

7.6. **Account Deletion.** If you request account deletion, we will delete your data within 30 days, except where retention is required by law.

## 8. Your Rights

### 8.1. Rights Under GDPR (EEA, UK, Switzerland)

You have the following rights regarding your personal data:

- **Right of Access (Art. 15)** — Request a copy of all personal data we hold about you.
- **Right to Rectification (Art. 16)** — Request correction of inaccurate personal data.
- **Right to Erasure (Art. 17)** — Request deletion of your personal data ("right to be forgotten"), subject to legal retention obligations and the immutability of on-chain data.
- **Right to Restrict Processing (Art. 18)** — Request that we limit how we process your data.
- **Right to Data Portability (Art. 20)** — Receive your data in a structured, commonly used, machine-readable format (JSON).
- **Right to Object (Art. 21)** — Object to processing based on legitimate interests.
- **Right to Withdraw Consent (Art. 7(3))** — Withdraw consent at any time where processing is based on consent.
- **Right to Lodge a Complaint** — File a complaint with your local data protection authority.

### 8.2. Rights Under CCPA (California Residents)

If you are a California resident, you have the following rights:

- **Right to Know** — Request disclosure of the categories and specific pieces of personal information we have collected about you.
- **Right to Delete** — Request deletion of personal information we have collected from you.
- **Right to Opt-Out** — Opt out of the "sale" of personal information. X.orb does not sell personal information.
- **Right to Non-Discrimination** — We will not discriminate against you for exercising your CCPA rights.

In the preceding 12 months, we have collected the categories of personal information described in Section 2. We have not sold any personal information. We have disclosed personal information to the service providers listed in Section 6 for business purposes.

### 8.3. Rights Under Australian Privacy Act

Under the Australian Privacy Principles (APPs), you have the right to:

- Access personal information we hold about you (APP 12).
- Request correction of inaccurate personal information (APP 13).
- Complain to the Office of the Australian Information Commissioner (OAIC) if you believe your privacy has been breached.

### 8.4. How to Exercise Your Rights

To exercise any of your data rights, contact us at:

- **Email:** contact@xorb.xyz
- **Subject Line:** "Data Rights Request — [Your Wallet Address]"

We will verify your identity by confirming ownership of the wallet address associated with your API key (e.g., by requesting a signed message). We will respond to verified requests within 30 days (or within the timeframe required by applicable law).

## 9. Data Portability

Upon request, we will export your data in JSON format, including:

- All registered agents and their metadata.
- Action history and pipeline results.
- Reputation scores and history.
- Audit logs.
- Webhook subscriptions.

Exports are provided via a secure, time-limited download link sent to a communication channel you specify.

## 10. Children's Privacy

The Service is not intended for use by individuals under the age of 18. We do not knowingly collect personal data from children. If we become aware that we have collected personal data from a child, we will take steps to delete such data promptly.

## 11. International Data Transfers

Your data may be transferred to and processed in countries outside your country of residence, including the United States (where Supabase and Vercel operate) and Australia (where Fintex Australia Pty Ltd is incorporated).

For transfers from the EEA, UK, or Switzerland, we implement appropriate safeguards including:

- Standard Contractual Clauses (SCCs) approved by the European Commission.
- Data processing agreements with all sub-processors.
- Technical measures including encryption at rest and in transit.

## 12. Changes to This Policy

We may update this Privacy Policy from time to time. Material changes will be communicated via the X.orb website at least 30 days before they take effect. The "Last Updated" date at the top of this policy indicates when it was most recently revised.

Continued use of the Service after changes take effect constitutes your acceptance of the revised Privacy Policy.

## 13. Data Protection Officer

For data protection inquiries, contact:

**Data Protection Contact**
Fintex Australia Pty Ltd
Email: contact@xorb.xyz
Subject: "Data Protection Inquiry"

If you are in the EEA and wish to contact a supervisory authority, you may do so with the data protection authority in your country of residence.

If you are in Australia, you may contact the Office of the Australian Information Commissioner (OAIC) at https://www.oaic.gov.au.

## 14. Contact Us

If you have any questions about this Privacy Policy, contact us at:

**Fintex Australia Pty Ltd**
ACN 688 406 108 | ABN 98 688 406 108
Sydney, New South Wales, Australia
Email: contact@xorb.xyz
Website: https://www.xorb.xyz

---

**Fintex Australia Pty Ltd**
ACN 688 406 108 | ABN 98 688 406 108
contact@xorb.xyz | https://www.xorb.xyz
