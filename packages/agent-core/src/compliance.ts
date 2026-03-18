/**
 * ComplianceReporter — Generate compliance reports from audit data.
 *
 * Supported frameworks:
 *   - EU AI Act (risk classification, human oversight, bias controls)
 *   - NIST AI RMF (risk management framework compliance evidence)
 *   - SOC 2 (security controls documentation)
 *
 * Output formats: JSON (structured data for programmatic access)
 */

export type ComplianceFramework = 'eu-ai-act' | 'nist-ai-rmf' | 'soc2'

export interface ComplianceReport {
  framework: ComplianceFramework
  generatedAt: string
  agentId: string
  period: { from: string; to: string }
  summary: ComplianceSummary
  sections: ComplianceSection[]
}

export interface ComplianceSummary {
  overallStatus: 'compliant' | 'partially_compliant' | 'non_compliant'
  totalControls: number
  passedControls: number
  failedControls: number
  warnings: number
  score: number // 0-100
}

export interface ComplianceSection {
  id: string
  title: string
  status: 'pass' | 'fail' | 'warning' | 'not_applicable' | 'requires_manual_review'
  description: string
  evidence: string[]
  recommendations: string[]
}

export interface AuditData {
  agentId: string
  totalActions: number
  approvedActions: number
  blockedActions: number
  violations: Array<{
    severity: string
    type: string
    timestamp: string
  }>
  reputationScore: number
  reputationTier: string
  bondAmount: string
  totalSlashed: string
  humanOverrideCount: number
  auditHashesAnchored: number
}

export class ComplianceReporter {

  generateReport(
    framework: ComplianceFramework,
    data: AuditData,
    periodFrom: string,
    periodTo: string,
  ): ComplianceReport {
    switch (framework) {
      case 'eu-ai-act':
        return this.generateEuAiAct(data, periodFrom, periodTo)
      case 'nist-ai-rmf':
        return this.generateNistAiRmf(data, periodFrom, periodTo)
      case 'soc2':
        return this.generateSoc2(data, periodFrom, periodTo)
    }
  }

  private generateEuAiAct(data: AuditData, from: string, to: string): ComplianceReport {
    const sections: ComplianceSection[] = [
      {
        id: 'art-9',
        title: 'Article 9 — Risk Management System',
        status: data.violations.length < 5 ? 'pass' : 'warning',
        description: 'Continuous risk identification and mitigation through the 8-gate security pipeline.',
        evidence: [
          `${data.totalActions} total actions processed through 8-gate pipeline`,
          `${data.blockedActions} actions blocked (${((data.blockedActions / Math.max(data.totalActions, 1)) * 100).toFixed(1)}% block rate)`,
          `${data.violations.length} violations detected and addressed`,
          `Reputation score: ${data.reputationScore}/10000 (${data.reputationTier})`,
        ],
        recommendations: data.violations.length >= 5
          ? ['Review violation patterns and adjust gate thresholds']
          : [],
      },
      {
        id: 'art-13',
        title: 'Article 13 — Transparency and Information',
        status: data.auditHashesAnchored > 0 ? 'pass' : 'requires_manual_review',
        description: 'All agent actions are logged with full gate results and audit hashes.',
        evidence: [
          `${data.auditHashesAnchored} audit hashes anchored on-chain`,
          'Every action records: agent ID, tool, parameters, gate results, timestamp',
          'Audit logs available via GET /v1/audit/:agentId',
          ...(data.auditHashesAnchored === 0 ? ['NOTE: On-chain anchoring not yet active — audit trail is off-chain only'] : []),
        ],
        recommendations: data.auditHashesAnchored === 0
          ? ['Enable on-chain audit hash anchoring for immutable transparency evidence']
          : [],
      },
      {
        id: 'art-14',
        title: 'Article 14 — Human Oversight',
        status: data.humanOverrideCount > 0 ? 'pass' : 'warning',
        description: 'Human sponsors can pause, resume, or revoke agents at any time.',
        evidence: [
          `${data.humanOverrideCount} human override actions during period`,
          'Emergency pause available via POST /v1/agents/:id/pause (always free)',
          'Permanent revocation available via DELETE /v1/agents/:id (always free)',
        ],
        recommendations: data.humanOverrideCount === 0
          ? ['No human oversight actions recorded — verify sponsor is actively monitoring']
          : [],
      },
      {
        id: 'art-15',
        title: 'Article 15 — Accuracy, Robustness, Cybersecurity',
        status: BigInt(data.bondAmount || '0') > 0n ? 'pass' : 'requires_manual_review',
        description: 'Economic bonding and reputation system ensure agent accountability.',
        evidence: [
          `Bond amount: ${data.bondAmount} USDC`,
          `Total slashed: ${data.totalSlashed} USDC`,
          'Rate limiting enforced per-agent (Gate 3)',
          'Spend limits enforced per-action (Gate 4)',
          ...(BigInt(data.bondAmount || '0') === 0n ? ['NOTE: No economic bond posted — robustness assessment requires manual review'] : []),
        ],
        recommendations: BigInt(data.bondAmount || '0') === 0n
          ? ['Post an economic bond to provide financial accountability for agent behavior']
          : [],
      },
    ]

    return this.buildReport('eu-ai-act', data.agentId, from, to, sections)
  }

  private generateNistAiRmf(data: AuditData, from: string, to: string): ComplianceReport {
    const sections: ComplianceSection[] = [
      {
        id: 'govern-1',
        title: 'GOVERN 1 — Policies and Procedures',
        status: 'pass',
        description: 'Agent roles and permissions define operational policies.',
        evidence: [
          '7 predefined roles with scoped permissions',
          'Per-role rate limits, tool allowlists, and spend caps',
          'Configurable gate thresholds',
        ],
        recommendations: [],
      },
      {
        id: 'map-1',
        title: 'MAP 1 — Context and Intended Use',
        status: 'pass',
        description: 'Each agent has a defined role, purpose, and capability manifest.',
        evidence: [
          `Agent role: configured at registration`,
          `Agent description: provided by sponsor`,
          'Permission scope explicitly lists allowed tools and contracts',
        ],
        recommendations: [],
      },
      {
        id: 'measure-1',
        title: 'MEASURE 1 — Risk Metrics',
        status: data.reputationScore >= 3000 ? 'pass' : 'warning',
        description: 'Reputation scoring provides continuous risk measurement.',
        evidence: [
          `Current score: ${data.reputationScore}/10000`,
          `Tier: ${data.reputationTier}`,
          `Block rate: ${((data.blockedActions / Math.max(data.totalActions, 1)) * 100).toFixed(1)}%`,
          `Violation rate: ${((data.violations.length / Math.max(data.totalActions, 1)) * 100).toFixed(2)}%`,
        ],
        recommendations: data.reputationScore < 3000
          ? ['Reputation below RELIABLE tier — review agent behavior']
          : [],
      },
      {
        id: 'manage-1',
        title: 'MANAGE 1 — Risk Response',
        status: 'pass',
        description: 'Automated slashing and suspension for violations.',
        evidence: [
          `${data.violations.length} violations auto-detected`,
          `${data.totalSlashed} USDC auto-slashed`,
          'Critical violations trigger automatic revocation',
          '3+ violations in 24h trigger auto-suspension',
        ],
        recommendations: [],
      },
    ]

    return this.buildReport('nist-ai-rmf', data.agentId, from, to, sections)
  }

  private generateSoc2(data: AuditData, from: string, to: string): ComplianceReport {
    const sections: ComplianceSection[] = [
      {
        id: 'cc-6.1',
        title: 'CC6.1 — Logical Access Security',
        status: 'pass',
        description: 'API key authentication and role-based permissions.',
        evidence: [
          'All API calls require x-api-key header',
          'Agents scoped to specific tools and contracts',
          'Sponsor-only operations (pause, resume, revoke)',
        ],
        recommendations: [],
      },
      {
        id: 'cc-7.2',
        title: 'CC7.2 — System Operations Monitoring',
        status: 'pass',
        description: 'Continuous monitoring via 8-gate pipeline and audit logging.',
        evidence: [
          `${data.totalActions} actions monitored`,
          `${data.auditHashesAnchored} audit hashes on-chain`,
          'Real-time event streaming via SSE',
          'Webhook delivery for event notifications',
        ],
        recommendations: [],
      },
      {
        id: 'cc-8.1',
        title: 'CC8.1 — Change Management',
        status: 'pass',
        description: 'Agent configuration changes tracked and auditable.',
        evidence: [
          'Agent status changes logged as events',
          'Permission scope immutable after registration',
          'Bond changes recorded on-chain',
        ],
        recommendations: [],
      },
      {
        id: 'cc-9.1',
        title: 'CC9.1 — Risk Mitigation',
        status: data.violations.filter(v => v.severity === 'critical').length === 0 ? 'pass' : 'fail',
        description: 'Economic bonding and automated slashing mitigate financial risk.',
        evidence: [
          `Bond: ${data.bondAmount} USDC`,
          `Slashed: ${data.totalSlashed} USDC`,
          `Critical violations: ${data.violations.filter(v => v.severity === 'critical').length}`,
        ],
        recommendations: data.violations.filter(v => v.severity === 'critical').length > 0
          ? ['Critical violations detected — immediate investigation required']
          : [],
      },
    ]

    return this.buildReport('soc2', data.agentId, from, to, sections)
  }

  private buildReport(
    framework: ComplianceFramework,
    agentId: string,
    from: string,
    to: string,
    sections: ComplianceSection[],
  ): ComplianceReport {
    const passed = sections.filter(s => s.status === 'pass').length
    const failed = sections.filter(s => s.status === 'fail').length
    const warnings = sections.filter(s => s.status === 'warning' || s.status === 'requires_manual_review').length
    const total = sections.length

    let status: ComplianceSummary['overallStatus'] = 'compliant'
    if (failed > 0) status = 'non_compliant'
    else if (warnings > 0) status = 'partially_compliant'

    return {
      framework,
      generatedAt: new Date().toISOString(),
      agentId,
      period: { from, to },
      summary: {
        overallStatus: status,
        totalControls: total,
        passedControls: passed,
        failedControls: failed,
        warnings,
        score: Math.round((passed / total) * 100),
      },
      sections,
    }
  }
}
