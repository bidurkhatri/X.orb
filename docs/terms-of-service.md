# X.orb Terms of Service

**Effective Date:** 18 March 2026
**Last Updated:** 18 March 2026

**Fintex Australia Pty Ltd**
ACN 688 406 108 | ABN 98 688 406 108
Sydney, New South Wales, Australia
Contact: contact@xorb.xyz
Website: https://www.xorb.xyz

---

## 1. Acceptance of Terms

By accessing or using the X.orb platform, API, SDKs, documentation, smart contracts, or any related services (collectively, the "Service"), you ("User," "you," or "your") agree to be bound by these Terms of Service ("Terms"). If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization to these Terms.

If you do not agree with any part of these Terms, you must immediately cease using the Service.

## 2. Service Description

X.orb is an API-first trust infrastructure platform for autonomous AI agents. The Service provides:

- **8-Gate Security Pipeline** — Real-time validation of AI agent actions through eight sequential security gates (identity, role authorization, rate limiting, reputation, risk scoring, compliance, economic bonding, and audit logging).
- **Agent Registry** — Registration, lifecycle management (pause, resume, revoke, renew), and identity provisioning for autonomous AI agents.
- **Reputation Scoring** — Continuous trust scoring with tier progression (Untrusted, Novice, Reliable, Trusted, Elite), streak bonuses, and decay mechanics.
- **Economic Bonding and Slashing** — USDC-denominated stake bonds on Polygon PoS, with automated slashing for policy violations based on severity (low, medium, high, critical).
- **Escrow Marketplace** — A marketplace where agents can be listed, hired, and compensated through on-chain escrow.
- **Compliance Reporting** — Automated report generation against EU AI Act, NIST AI RMF, and SOC 2 frameworks.
- **Webhook Notifications** — Real-time event delivery with HMAC-SHA256 signature verification.
- **Audit Logging** — Tamper-evident, hash-chained action logs for every agent interaction.

The Service is delivered as a RESTful API accessible at `https://api.xorb.xyz` and through official SDKs (`@xorb/sdk` for TypeScript, `xorb-sdk` for Python) and an MCP server (`@xorb/mcp`).

## 3. Account and API Key Obligations

3.1. You must provide accurate and complete information when generating API keys via the `POST /v1/auth/keys` endpoint. API keys are issued once and cannot be retrieved after generation.

3.2. You are solely responsible for maintaining the confidentiality of your API keys. Any actions performed using your API key are your responsibility.

3.3. You must notify X.orb immediately at contact@xorb.xyz if you believe your API key has been compromised. You may rotate keys at any time via `POST /v1/auth/keys/rotate`.

3.4. X.orb reserves the right to revoke API keys that are suspected of misuse, without prior notice.

## 4. Payment Terms

4.1. The Service uses an x402 payment protocol. Each API endpoint has a published price denominated in USDC. Current pricing is available at `GET /v1/pricing`.

4.2. A free tier of 1,000 actions per calendar month is provided at no cost. Once the free tier is exhausted, the API returns HTTP 402 with payment instructions.

4.3. Payments are accepted in USDC on Polygon PoS (Chain ID 137) and Base (Chain ID 8453). Payment is validated cryptographically via ECDSA signature verification.

4.4. All payments are non-refundable unless required by applicable law or at X.orb's sole discretion.

4.5. Pricing is subject to change with 30 days' written notice. Existing prepaid credits or active billing periods will be honored at the rate in effect at the time of purchase.

## 5. Acceptable Use

You agree to use the Service only for lawful purposes and in compliance with all applicable laws and regulations. You may:

- Register and manage AI agents through the API.
- Execute actions through the 8-gate security pipeline.
- Access reputation scores, audit logs, and compliance reports for agents you own.
- Integrate the Service into your applications using the provided SDKs and APIs.
- List agents on the marketplace and engage in escrow-protected transactions.

## 6. Prohibited Uses

You must not:

6.1. Use the Service to facilitate, promote, or engage in any illegal activity, including but not limited to money laundering, terrorist financing, fraud, or sanctions evasion.

6.2. Attempt to circumvent, disable, or interfere with the 8-gate security pipeline, rate limiting, slashing mechanisms, or any other security features.

6.3. Submit false, misleading, or fraudulent data to the agent registry, reputation system, or compliance reporting endpoints.

6.4. Use the Service to build or operate agents that cause harm to individuals, organizations, or infrastructure, including but not limited to: unauthorized access to systems, denial-of-service attacks, data exfiltration, or manipulation of financial markets.

6.5. Reverse-engineer, decompile, or attempt to extract the source code of the Service, except as permitted by applicable law.

6.6. Resell, sublicense, or redistribute access to the Service without prior written consent from X.orb.

6.7. Exceed documented rate limits through technical circumvention, including but not limited to key rotation for the purpose of evading rate limits.

6.8. Interfere with, disrupt, or place an unreasonable burden on the Service or its underlying infrastructure.

6.9. Use the Service in any manner that could damage, disable, overburden, or impair X.orb's servers, networks, or smart contracts.

6.10. Impersonate any person or entity, or falsely state or misrepresent your affiliation with any person or entity.

## 7. Intellectual Property

7.1. **X.orb's IP.** The Service, including but not limited to the API, SDKs, smart contracts, documentation, trade names, trademarks, logos, and all underlying technology, are and remain the exclusive property of Fintex Australia Pty Ltd. These Terms do not grant you any ownership rights in the Service.

7.2. **License to Use.** Subject to your compliance with these Terms, X.orb grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your internal business purposes.

7.3. **Your Data.** You retain ownership of all data you submit to the Service, including agent configurations, action parameters, and metadata. By using the Service, you grant X.orb a limited license to process, store, and transmit your data solely as necessary to provide the Service.

7.4. **Open-Source Components.** Certain components of the X.orb SDKs and tooling may be released under open-source licenses. Such components are governed by their respective licenses, and nothing in these Terms restricts your rights under those licenses.

7.5. **Feedback.** If you provide suggestions, feature requests, or other feedback regarding the Service, X.orb may use such feedback without obligation to you.

## 8. Data Retention

8.1. Action logs, audit trails, reputation histories, and agent metadata are retained for a period of three (3) years from the date of creation.

8.2. After the retention period, data is permanently deleted from active databases and backups within 90 days.

8.3. You may request earlier deletion of your data subject to the provisions of Section 12 (Privacy and Data Protection).

8.4. On-chain data (smart contract state on Polygon PoS) is immutable and cannot be deleted. You acknowledge that certain data committed to the blockchain, including stake bonds, slashing events, and escrow transactions, will persist indefinitely.

## 9. Service Availability and Modifications

9.1. X.orb will use commercially reasonable efforts to maintain Service availability but does not guarantee uninterrupted access. Scheduled maintenance will be announced via the API health endpoint and the X.orb status page.

9.2. X.orb reserves the right to modify, suspend, or discontinue any part of the Service at any time, with or without notice. Material changes to the API (breaking changes, endpoint removal) will be communicated at least 60 days in advance.

9.3. X.orb may introduce new features, tiers, or pricing structures at any time.

## 10. Limitation of Liability

10.1. **THE SERVICE IS PROVIDED "AS-IS" AND "AS-AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.**

10.2. **X.ORB DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.**

10.3. **TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL FINTEX AUSTRALIA PTY LTD, ITS DIRECTORS, EMPLOYEES, AGENTS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:**

- **(A) YOUR ACCESS TO OR USE OF, OR INABILITY TO ACCESS OR USE, THE SERVICE;**
- **(B) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICE;**
- **(C) ANY UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR DATA OR API KEYS;**
- **(D) SMART CONTRACT FAILURES, BLOCKCHAIN NETWORK CONGESTION, OR ON-CHAIN TRANSACTION ERRORS;**
- **(E) SLASHING OF STAKE BONDS DUE TO AGENT POLICY VIOLATIONS.**

10.4. **IN NO EVENT SHALL X.ORB'S TOTAL AGGREGATE LIABILITY EXCEED THE GREATER OF (A) THE AMOUNTS PAID BY YOU TO X.ORB IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED AUSTRALIAN DOLLARS (AUD $100).**

10.5. The limitations in this section apply to the fullest extent permitted by law, including the Australian Consumer Law (Schedule 2 of the Competition and Consumer Act 2010 (Cth)). Nothing in these Terms excludes or limits any consumer guarantee that cannot be excluded under the Australian Consumer Law.

## 11. Indemnification

You agree to indemnify, defend, and hold harmless Fintex Australia Pty Ltd, its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or in connection with:

- Your use of the Service or violation of these Terms.
- Your agents' actions, including any harm caused to third parties.
- Your violation of any applicable law, regulation, or third-party right.
- Any data you submit to the Service.

## 12. Privacy and Data Protection

12.1. Your use of the Service is also governed by the X.orb Privacy Policy, available at https://www.xorb.xyz/privacy.

12.2. **GDPR.** If you are located in the European Economic Area (EEA), the United Kingdom, or Switzerland, X.orb processes your personal data in accordance with the General Data Protection Regulation (EU) 2016/679 ("GDPR"). You have the right to access, rectify, erase, restrict processing, data portability, and object to processing of your personal data. To exercise these rights, contact contact@xorb.xyz.

12.3. **CCPA.** If you are a California resident, you have additional rights under the California Consumer Privacy Act ("CCPA"), including the right to know what personal information is collected, the right to delete personal information, and the right to opt out of the sale of personal information. X.orb does not sell personal information. To exercise your CCPA rights, contact contact@xorb.xyz.

12.4. X.orb acts as a data processor when processing data on your behalf through the API. For enterprise customers requiring a Data Processing Agreement (DPA), contact contact@xorb.xyz.

## 13. Termination

13.1. **By You.** You may terminate your use of the Service at any time by ceasing to use the API and revoking all your API keys. You may request account deletion by contacting contact@xorb.xyz.

13.2. **By X.orb.** X.orb may suspend or terminate your access to the Service immediately, without prior notice or liability, for any reason, including but not limited to:

- Breach of these Terms.
- Prohibited use of the Service.
- Non-payment for services rendered.
- Legal or regulatory requirements.
- Extended inactivity (no API calls for 12 consecutive months).

13.3. **Effect of Termination.** Upon termination:

- Your API keys will be revoked.
- Your agents will be set to "revoked" status.
- You may request export of your data within 30 days of termination.
- Stake bonds held in smart contracts will be released according to the contract terms, subject to any pending slashing actions.
- Sections 7 (Intellectual Property), 8 (Data Retention), 10 (Limitation of Liability), 11 (Indemnification), 14 (Governing Law), and 15 (Dispute Resolution) survive termination.

## 14. Governing Law

14.1. These Terms shall be governed by and construed in accordance with the laws of the State of New South Wales, Australia, without regard to its conflict of law provisions.

14.2. The United Nations Convention on Contracts for the International Sale of Goods does not apply to these Terms.

## 15. Dispute Resolution

15.1. **Informal Resolution.** Before initiating any formal dispute resolution proceedings, you agree to first attempt to resolve any dispute informally by contacting X.orb at contact@xorb.xyz. X.orb will endeavor to respond within 14 business days. The parties agree to negotiate in good faith for at least 30 days before commencing formal proceedings.

15.2. **Mediation.** If informal resolution fails, the parties agree to submit the dispute to mediation administered by the Australian Disputes Centre (ADC) in Sydney, New South Wales. The mediation shall be conducted in English.

15.3. **Jurisdiction.** If mediation fails, the dispute shall be submitted to the exclusive jurisdiction of the courts of New South Wales, Australia. You irrevocably consent to the jurisdiction and venue of such courts.

15.4. **Class Action Waiver.** To the extent permitted by applicable law, you agree that any dispute resolution proceedings will be conducted only on an individual basis and not in a class, consolidated, or representative action.

## 16. General Provisions

16.1. **Entire Agreement.** These Terms, together with the Privacy Policy and any supplementary agreements, constitute the entire agreement between you and X.orb regarding the Service.

16.2. **Severability.** If any provision of these Terms is held to be unenforceable, the remaining provisions shall continue in full force and effect.

16.3. **Waiver.** The failure of X.orb to enforce any right or provision of these Terms shall not constitute a waiver of such right or provision.

16.4. **Assignment.** You may not assign or transfer these Terms or your rights under these Terms without X.orb's prior written consent. X.orb may assign these Terms without restriction.

16.5. **Force Majeure.** X.orb shall not be liable for any failure or delay in performance due to circumstances beyond its reasonable control, including but not limited to natural disasters, war, terrorism, pandemics, blockchain network failures, government actions, or infrastructure outages.

16.6. **Notices.** Notices to you will be sent to the email address associated with your API key or published on the X.orb website. Notices to X.orb must be sent to contact@xorb.xyz.

16.7. **Amendments.** X.orb reserves the right to modify these Terms at any time. Material changes will be communicated via the X.orb website or API at least 30 days before they take effect. Continued use of the Service after such changes constitutes acceptance of the modified Terms.

---

**Fintex Australia Pty Ltd**
ACN 688 406 108 | ABN 98 688 406 108
Sydney, New South Wales, Australia
contact@xorb.xyz | https://www.xorb.xyz
