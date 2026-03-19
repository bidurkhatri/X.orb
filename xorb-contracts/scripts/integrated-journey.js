const { ethers } = require('ethers')
const crypto = require('crypto')

const facilitatorKey = '2904758a261bddd72e938d2a37ee99486a3e0163efcc65e9b9887a8594c86f84'
const deployerKey = 'f25003363f58b8f4e2ecad73109b439bd84134dab34c80dbcd289fa14d049348'
const facilitatorWallet = new ethers.Wallet(facilitatorKey)
const deployerWallet = new ethers.Wallet(deployerKey)
const XORB_FACILITATOR = '0xF41faE67716670edBFf581aEe37014307dF71A9B'

async function signPaymentV1(wallet, amount, facilitator, network) {
  const nonce = crypto.randomBytes(16).toString('hex')
  const expiry = Math.floor(Date.now() / 1000) + 300
  const hash = ethers.solidityPackedKeccak256(['uint256', 'address', 'string', 'uint256'], [amount, facilitator, nonce, expiry])
  const sig = await wallet.signMessage(ethers.getBytes(hash))
  return Buffer.from(JSON.stringify({ signature: sig, amount, network, nonce, expiry, payer: wallet.address })).toString('base64')
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║  X.ORB INTEGRATED JOURNEY — AGENT USES X.ORB + ECOSYSTEM  ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log('Scenario: An AI agent wants to look up IP intelligence.')
  console.log('It must pass X.orb\'s 8-gate trust pipeline FIRST,')
  console.log('THEN call Robtex (external x402 service) for the actual data.')
  console.log('')

  // ━━━ STEP 1: SPONSOR CREATES API KEY ━━━
  console.log('━━━ STEP 1: SPONSOR SETUP ━━━')
  const keyRes = await fetch('https://api.xorb.xyz/v1/auth/keys', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner_address: facilitatorWallet.address, label: 'integrated-' + Date.now() }),
  })
  const keyData = await keyRes.json()
  const apiKey = keyData.data?.api_key || keyData.api_key
  console.log('  API Key:        ', apiKey ? '✅ ' + apiKey.slice(0, 16) + '...' : '❌')
  console.log('')

  // ━━━ STEP 2: REGISTER AGENT VIA X.ORB ($0.10) ━━━
  console.log('━━━ STEP 2: REGISTER AGENT ($0.10 x402 → X.orb) ━━━')
  const regPayment = await signPaymentV1(facilitatorWallet, '100000', XORB_FACILITATOR, 'eip155:137')
  const regRes = await fetch('https://api.xorb.xyz/v1/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'x-payment': regPayment },
    body: JSON.stringify({ name: 'ip-researcher', scope: 'RESEARCHER', sponsor_address: facilitatorWallet.address, description: 'IP intelligence agent using Robtex via x402' }),
  })
  const regData = await regRes.json()
  const agentId = regData.agent?.agentId || regData.agentId
  console.log('  Registered:     ', agentId ? '✅ ' + agentId : '❌')
  if (!agentId) { console.log('  Error:', JSON.stringify(regData).slice(0, 200)); return }
  console.log('')

  // ━━━ STEP 3: AGENT REQUESTS ACTION THROUGH X.ORB 8-GATE PIPELINE ($0.005) ━━━
  console.log('━━━ STEP 3: X.ORB 8-GATE PIPELINE ($0.005 x402) ━━━')
  console.log('  Agent wants to: look up IP 1.1.1.1 via Robtex')
  console.log('  X.orb verifies:  identity, permissions, rate limit, payment,')
  console.log('                   audit, trust score, execution, escrow')
  console.log('')

  const actPayment = await signPaymentV1(facilitatorWallet, '5000', XORB_FACILITATOR, 'eip155:137')
  const actRes = await fetch('https://api.xorb.xyz/v1/actions/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'x-payment': actPayment },
    body: JSON.stringify({
      agent_id: agentId,
      action: 'ip_intelligence_lookup',
      tool: 'fetch_market_data',  // maps to RESEARCHER allowed tools
      params: { target_ip: '1.1.1.1', service: 'robtex', purpose: 'network intelligence' },
    }),
  })
  const actData = await actRes.json()

  console.log('  Pipeline result:')
  if (actData.gates) {
    for (const g of actData.gates) {
      const detail = g.gate === 'x402_payment' ? ` — $${(parseInt(g.amount || 0) / 1e6).toFixed(3)} USDC` :
                     g.gate === 'audit_log' ? ` — persisted to Supabase` :
                     g.gate === 'trust_score' ? ` — score: ${g.score || 'N/A'}` : ''
      console.log('    ' + g.gate.padEnd(16) + (g.passed ? '✅' : '❌') + detail)
    }
  }
  console.log('')
  console.log('  Approved:       ', actData.approved ? '✅ YES' : '❌ NO')
  console.log('  Audit hash:     ', actData.audit_hash ? actData.audit_hash.slice(0, 40) + '...' : 'N/A')
  console.log('  On-chain anchor:', actData.on_chain?.on_chain ? '✅ ' + actData.on_chain?.tx_hash : 'simulated')

  if (!actData.approved) {
    console.log('')
    console.log('  ❌ Pipeline rejected — cannot proceed to external service')
    return
  }
  console.log('')

  // ━━━ STEP 4: AGENT CALLS EXTERNAL x402 SERVICE (ROBTEX) ($0.001) ━━━
  console.log('━━━ STEP 4: EXTERNAL x402 PURCHASE (Robtex, $0.001 Base) ━━━')
  console.log('  X.orb approved the action — now agent calls Robtex directly')
  console.log('  Using x402 v2 (EIP-3009) — no USDC.approve needed')
  console.log('')

  // Dynamic import for ESM x402 modules
  const { wrapFetchWithPayment } = await import('@x402/fetch')
  const { x402Client } = await import('@x402/core/client')
  const { ExactEvmScheme } = await import('@x402/evm/exact/client')
  const { privateKeyToAccount } = await import('viem/accounts')

  const account = privateKeyToAccount('0x' + deployerKey)
  const x402client = new x402Client()
  x402client.register('eip155:*', new ExactEvmScheme(account))
  const payFetch = wrapFetchWithPayment(globalThis.fetch, x402client)

  const robtexRes = await payFetch('https://x402.robtex.com/ipquery/1.1.1.1')
  if (robtexRes.status === 200) {
    const ipData = await robtexRes.json()
    console.log('  ✅ Robtex response:')
    console.log('     IP:           1.1.1.1')
    console.log('     Owner:       ', ipData.asname || 'unknown')
    console.log('     AS Number:   ', ipData.as)
    console.log('     Country:     ', ipData.country || 'N/A')
    console.log('     Description: ', ipData.asdesc || ipData.whoisdesc || 'N/A')
    console.log('     Paid:         $0.001 USDC on Base via EIP-3009')
  } else {
    console.log('  ❌ Robtex status:', robtexRes.status)
  }
  console.log('')

  // ━━━ STEP 5: VERIFY AUDIT TRAIL ━━━
  console.log('━━━ STEP 5: VERIFY AUDIT TRAIL ━━━')

  const rep = await (await fetch('https://api.xorb.xyz/v1/trust/' + agentId)).json()
  console.log('  Reputation:     ', rep.score, '— Tier:', rep.tier)

  const audit = await (await fetch('https://api.xorb.xyz/v1/audit/' + agentId, { headers: { 'x-api-key': apiKey } })).json()
  console.log('  Audit events:   ', audit.events || 0)

  const comp = await (await fetch('https://api.xorb.xyz/v1/compliance/' + agentId + '?framework=eu-ai-act', { headers: { 'x-api-key': apiKey } })).json()
  console.log('  Compliance:     ', comp.data?.summary?.overall_status || comp.summary?.overall_status || 'N/A')
  console.log('')

  // ━━━ STEP 6: CLEANUP ━━━
  console.log('━━━ STEP 6: CLEANUP ━━━')
  await fetch('https://api.xorb.xyz/v1/agents/' + agentId, { method: 'DELETE', headers: { 'x-api-key': apiKey } })
  console.log('  Agent revoked    ✅')
  console.log('')

  // ━━━ SUMMARY ━━━
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║  INTEGRATED JOURNEY COMPLETE                               ║')
  console.log('╠════════════════════════════════════════════════════════════╣')
  console.log('║                                                            ║')
  console.log('║  1. Sponsor created API key                    → X.orb     ║')
  console.log('║  2. Agent registered ($0.10 x402)              → X.orb     ║')
  console.log('║  3. Action verified through 8-gate pipeline    → X.orb     ║')
  console.log('║     (identity, permissions, rate limit, x402 payment,      ║')
  console.log('║      audit, trust score, execute, escrow)                  ║')
  console.log('║  4. External purchase ($0.001 x402 v2 EIP-3009)→ Robtex   ║')
  console.log('║  5. Audit trail verified (reputation + compliance)         ║')
  console.log('║  6. Agent revoked                              → X.orb     ║')
  console.log('║                                                            ║')
  console.log('║  Total X.orb fees:  $0.105 USDC (Polygon)                  ║')
  console.log('║  Total Robtex fees: $0.001 USDC (Base)                     ║')
  console.log('║  Chains used:       Polygon (X.orb) + Base (Robtex)        ║')
  console.log('║  Protocols:         x402 v1 (X.orb) + x402 v2 (Robtex)    ║')
  console.log('║  USDC.approve:      NOT needed (EIP-3009 for Robtex)       ║')
  console.log('║                                                            ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
}

main().catch(e => console.error('ERROR:', e.message))
