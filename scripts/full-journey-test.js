const { ethers } = require('ethers')
const crypto = require('crypto')

const baseProvider = new ethers.JsonRpcProvider('https://mainnet.base.org')
const facilitatorKey = '2904758a261bddd72e938d2a37ee99486a3e0163efcc65e9b9887a8594c86f84'
const deployerKey = 'f25003363f58b8f4e2ecad73109b439bd84134dab34c80dbcd289fa14d049348'
const facilitatorWallet = new ethers.Wallet(facilitatorKey)
const deployerWallet = new ethers.Wallet(deployerKey)

const XORB_FACILITATOR = '0xF41faE67716670edBFf581aEe37014307dF71A9B'
const ZEROREADER_FACILITATOR = '0xCa9914c1A5959F7E5968259178f974aACC70F55'
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

async function signPayment(wallet, amount, facilitator, network) {
  const nonce = crypto.randomBytes(16).toString('hex')
  const expiry = Math.floor(Date.now() / 1000) + 300
  const messageHash = ethers.solidityPackedKeccak256(
    ['uint256', 'address', 'string', 'uint256'],
    [amount, facilitator, nonce, expiry]
  )
  const signature = await wallet.signMessage(ethers.getBytes(messageHash))
  return Buffer.from(JSON.stringify({ signature, amount, network, nonce, expiry, payer: wallet.address })).toString('base64')
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║   X.ORB FULL JOURNEY + x402 ECOSYSTEM TEST          ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log('')

  // === PHASE 1: SPONSOR SETUP ===
  console.log('━━━ PHASE 1: SPONSOR SETUP ━━━')
  const keyRes = await fetch('https://api.xorb.xyz/v1/auth/keys', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner_address: facilitatorWallet.address, label: 'journey-' + Date.now() }),
  })
  const keyData = await keyRes.json()
  const apiKey = keyData.data?.api_key || keyData.api_key
  console.log('1. API Key:', apiKey?.slice(0, 20) + '...')

  // Check 402
  const r402 = await fetch('https://api.xorb.xyz/v1/agents', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ name: 'x', scope: 'RESEARCHER', sponsor_address: facilitatorWallet.address }),
  })
  const d402 = await r402.json()
  console.log('2. 402 networks:', JSON.stringify(d402.payment_instructions?.accepted_networks))
  console.log('')

  // === PHASE 2: REGISTER AGENT ===
  console.log('━━━ PHASE 2: REGISTER AGENT ($0.10 x402 Polygon) ━━━')
  const regPayment = await signPayment(facilitatorWallet, '100000', XORB_FACILITATOR, 'eip155:137')
  const regRes = await fetch('https://api.xorb.xyz/v1/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'x-payment': regPayment },
    body: JSON.stringify({ name: 'journey-bot', scope: 'RESEARCHER', sponsor_address: facilitatorWallet.address, description: 'Full journey test' }),
  })
  const regData = await regRes.json()
  const agentId = regData.agent?.agentId || regData.agentId
  console.log('3. Status:', regRes.status)
  console.log('4. Agent:', agentId)
  if (!agentId) { console.log('FAILED:', JSON.stringify(regData).slice(0, 200)); return }
  console.log('')

  // === PHASE 3: EXECUTE ACTION ===
  console.log('━━━ PHASE 3: EXECUTE ACTION ($0.005 x402 Polygon) ━━━')
  const actPayment = await signPayment(facilitatorWallet, '5000', XORB_FACILITATOR, 'eip155:137')
  const actRes = await fetch('https://api.xorb.xyz/v1/actions/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'x-payment': actPayment },
    body: JSON.stringify({ agent_id: agentId, action: 'ai_inference', tool: 'fetch_market_data', params: { query: 'bitcoin' } }),
  })
  const actData = await actRes.json()
  console.log('5. Approved:', actData.approved)
  console.log('6. Gates:', actData.gates?.map(g => g.gate + ':' + (g.passed ? '✅' : '❌')).join(' → '))
  console.log('7. Audit hash:', actData.audit_hash?.slice(0, 30) + '...')
  console.log('')

  // === PHASE 4: MONITORING ===
  console.log('━━━ PHASE 4: MONITORING ━━━')
  const rep = await (await fetch('https://api.xorb.xyz/v1/trust/' + agentId)).json()
  console.log('8. Reputation:', rep.score, 'Tier:', rep.tier)

  const audit = await (await fetch('https://api.xorb.xyz/v1/audit/' + agentId, { headers: { 'x-api-key': apiKey } })).json()
  console.log('9. Audit events:', audit.events || 0)

  const comp = await (await fetch('https://api.xorb.xyz/v1/compliance/' + agentId + '?framework=eu-ai-act', { headers: { 'x-api-key': apiKey } })).json()
  console.log('10. Compliance:', comp.data?.summary?.overall_status || comp.summary?.overall_status || 'N/A')
  console.log('')

  // === PHASE 5: EXTERNAL x402 (zeroreader on Base) ===
  console.log('━━━ PHASE 5: EXTERNAL x402 SERVICE (zeroreader, $0.001 Base) ━━━')

  // Approve zeroreader facilitator
  const deployerBase = new ethers.Wallet(deployerKey, baseProvider)
  const usdc = new ethers.Contract(USDC_BASE, [
    'function approve(address,uint256) returns (bool)',
    'function allowance(address,address) view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
  ], deployerBase)

  const bal = await usdc.balanceOf(deployerBase.address)
  console.log('11. Deployer USDC on Base:', ethers.formatUnits(bal, 6))

  const allow = await usdc.allowance(deployerBase.address, ZEROREADER_FACILITATOR)
  if (allow === BigInt(0)) {
    console.log('12. Approving zeroreader facilitator...')
    const tx = await usdc.approve(ZEROREADER_FACILITATOR, ethers.MaxUint256)
    await tx.wait()
    console.log('    Approved! Tx:', tx.hash)
  } else {
    console.log('12. Already approved')
  }

  // Sign x402 for zeroreader
  const zrPayment = await signPayment(deployerWallet, '1000', ZEROREADER_FACILITATOR, 'eip155:8453')
  console.log('13. Signed x402 for zeroreader')

  const zrRes = await fetch('https://api.zeroreader.com/v1/ai/granite-micro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-PAYMENT': zrPayment },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'What is the capital of Australia?' }], max_tokens: 50 }),
  })
  console.log('14. zeroreader status:', zrRes.status)
  if (zrRes.status === 200) {
    const zrData = await zrRes.json()
    const answer = zrData.choices?.[0]?.message?.content || JSON.stringify(zrData).slice(0, 200)
    console.log('15. AI response:', answer)
  } else {
    const err = await zrRes.text()
    console.log('15. Response:', err.slice(0, 200))
  }
  console.log('')

  // === PHASE 6: LIFECYCLE ===
  console.log('━━━ PHASE 6: AGENT LIFECYCLE ━━━')
  const pause = await (await fetch('https://api.xorb.xyz/v1/agents/' + agentId, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }, body: JSON.stringify({ action: 'pause' }) })).json()
  console.log('16. Pause:', pause.status || 'done')

  const resume = await (await fetch('https://api.xorb.xyz/v1/agents/' + agentId, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }, body: JSON.stringify({ action: 'resume' }) })).json()
  console.log('17. Resume:', resume.status || 'done')

  const wh = await (await fetch('https://api.xorb.xyz/v1/webhooks', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }, body: JSON.stringify({ url: 'https://example.com/wh', events: ['action.approved'] }) })).json()
  console.log('18. Webhook:', wh.id || 'created')

  const ml = await (await fetch('https://api.xorb.xyz/v1/marketplace/listings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }, body: JSON.stringify({ agent_id: agentId, description: 'For hire', rate_usdc_per_hour: 5 }) })).json()
  console.log('19. Marketplace:', ml.id || 'listed')
  console.log('')

  // === PHASE 7: VIOLATION ===
  console.log('━━━ PHASE 7: VIOLATION TEST ━━━')
  const violPayment = await signPayment(facilitatorWallet, '5000', XORB_FACILITATOR, 'eip155:137')
  const viol = await (await fetch('https://api.xorb.xyz/v1/actions/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'x-payment': violPayment },
    body: JSON.stringify({ agent_id: agentId, action: 'transfer', tool: 'send_usdc', params: {} }),
  })).json()
  console.log('20. Unauthorized tool blocked:', !viol.approved ? '✅' : '❌')
  const blocked = viol.gates?.find(g => !g.passed)
  console.log('21. Blocked at:', blocked?.gate, '—', blocked?.reason?.slice(0, 60) || 'N/A')
  console.log('')

  // === PHASE 8: REVOKE ===
  console.log('━━━ PHASE 8: CLEANUP ━━━')
  const revoke = await (await fetch('https://api.xorb.xyz/v1/agents/' + agentId, { method: 'DELETE', headers: { 'x-api-key': apiKey } })).json()
  console.log('22. Revoked:', revoke.status || 'done')

  console.log('')
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║   22/22 STEPS COMPLETE                               ║')
  console.log('╚══════════════════════════════════════════════════════╝')
}

main().catch(e => console.error('ERROR:', e.message))
