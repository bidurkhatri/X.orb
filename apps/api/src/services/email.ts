/**
 * EmailService — Notification emails via Resend.
 * Graceful degradation: if RESEND_API_KEY is not set, logs warning and returns.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'notifications@xorb.xyz'

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not configured — email not sent:', subject)
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    })
    if (!res.ok) {
      console.error('[Email] Send failed:', await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('[Email] Send error:', err)
    return false
  }
}

export class EmailService {
  async sendSlashingAlert(to: string, agentId: string, severity: string, amount: string): Promise<boolean> {
    return sendEmail(to, `[X.orb] Agent Slashed — ${severity}`, `
      <h2>Agent Slashed</h2>
      <p>Your agent <strong>${agentId}</strong> has been slashed.</p>
      <ul>
        <li><strong>Severity:</strong> ${severity}</li>
        <li><strong>Amount:</strong> ${amount} USDC</li>
      </ul>
      <p>Review your agent's status in the <a href="https://dashboard.xorb.xyz/agents">X.orb Dashboard</a>.</p>
    `)
  }

  async sendReputationWarning(to: string, agentId: string, score: number, tier: string): Promise<boolean> {
    return sendEmail(to, `[X.orb] Reputation Warning — ${tier}`, `
      <h2>Reputation Warning</h2>
      <p>Your agent <strong>${agentId}</strong> has dropped to <strong>${tier}</strong> tier (score: ${score}/10000).</p>
      <p>If reputation falls below 500, the agent will be automatically paused.</p>
      <p><a href="https://dashboard.xorb.xyz/agents">View Dashboard</a></p>
    `)
  }

  async sendApiKeyExpiring(to: string, keyPrefix: string, expiresAt: string): Promise<boolean> {
    return sendEmail(to, '[X.orb] API Key Expiring Soon', `
      <h2>API Key Expiring</h2>
      <p>Your API key <code>${keyPrefix}...</code> expires on <strong>${expiresAt}</strong>.</p>
      <p>Rotate your key before it expires to avoid service interruption.</p>
      <p><a href="https://dashboard.xorb.xyz/settings">Manage API Keys</a></p>
    `)
  }

  async sendPaymentReceipt(to: string, actionId: string, amount: string, fee: string): Promise<boolean> {
    return sendEmail(to, `[X.orb] Payment Receipt — ${amount} USDC`, `
      <h2>Payment Receipt</h2>
      <p><strong>Action:</strong> ${actionId}</p>
      <p><strong>Amount:</strong> ${amount} USDC</p>
      <p><strong>Platform Fee:</strong> ${fee} USDC</p>
      <p><a href="https://dashboard.xorb.xyz/billing">View Payment History</a></p>
    `)
  }

  async sendFreeTierWarning(to: string, used: number, limit: number): Promise<boolean> {
    const pct = Math.round((used / limit) * 100)
    return sendEmail(to, `[X.orb] Free Tier ${pct}% Used`, `
      <h2>Free Tier Usage Warning</h2>
      <p>You've used <strong>${used} of ${limit}</strong> free actions this month (${pct}%).</p>
      <p>When your free tier is exhausted, you'll need to set up USDC payments to continue.</p>
      <p><a href="https://dashboard.xorb.xyz/billing">Set Up Payments</a></p>
    `)
  }
}

let _emailService: EmailService | null = null
export function getEmailService(): EmailService {
  if (!_emailService) _emailService = new EmailService()
  return _emailService
}
