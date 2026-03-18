# X.orb Webhook Documentation

Webhooks allow you to receive real-time HTTP notifications when events occur on the X.orb platform. Instead of polling the API, register a webhook endpoint and X.orb will push events to your server as they happen.

---

## Registering a Webhook

Subscribe to events by providing your endpoint URL and the event types you want to receive.

### Request

```
POST /v1/webhooks
```

```bash
curl -X POST https://api.xorb.xyz/v1/webhooks \
  -H "Content-Type: application/json" \
  -H "x-api-key: xorb_sk_..." \
  -d '{
    "url": "https://your-server.com/webhooks/xorb",
    "event_types": ["action.approved", "action.blocked", "agent.slashed"]
  }'
```

### Response

```json
{
  "id": "wh_1710720000000_abc123",
  "url": "https://your-server.com/webhooks/xorb",
  "event_types": ["action.approved", "action.blocked", "agent.slashed"],
  "secret": "whsec_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "active": true
}
```

Save the `secret` value securely. It is used to verify webhook signatures and is only returned once at creation time.

### Using TypeScript SDK

```typescript
const webhook = await client.webhooks.subscribe(
  'https://your-server.com/webhooks/xorb',
  ['action.approved', 'action.blocked', 'agent.slashed']
)

console.log('Webhook ID:', webhook.id)
console.log('Secret:', webhook.secret) // Store this securely
```

### Using Python SDK

```python
webhook = client.webhooks.subscribe(
    url="https://your-server.com/webhooks/xorb",
    event_types=["action.approved", "action.blocked", "agent.slashed"],
)

print(f"Webhook ID: {webhook.id}")
print(f"Secret: {webhook.secret}")  # Store this securely
```

---

## Event Types

| Event Type | Description | Trigger |
|-----------|-------------|---------|
| `agent.registered` | A new agent has been registered | `POST /v1/agents` |
| `action.approved` | An action passed all 8 gates | `POST /v1/actions/execute` (approved) |
| `action.blocked` | An action was blocked by a gate | `POST /v1/actions/execute` (blocked) |
| `agent.slashed` | An agent's stake was slashed | Automatic (policy violation) |
| `reputation.changed` | An agent's reputation score changed | After any action execution |

---

## Event Payloads

All webhook payloads share a common envelope:

```json
{
  "id": "evt_1710720100000_xyz789",
  "type": "action.approved",
  "timestamp": "2026-03-18T10:01:40.000Z",
  "data": { ... }
}
```

### agent.registered

```json
{
  "id": "evt_1710720000001_reg001",
  "type": "agent.registered",
  "timestamp": "2026-03-18T10:00:00.000Z",
  "data": {
    "agent_id": "agent_1710720000000_abc123",
    "name": "research-bot",
    "role": "RESEARCHER",
    "sponsor_address": "0xYourWalletAddress",
    "reputation": 50,
    "reputation_tier": "NOVICE",
    "status": "active",
    "expires_at": 1713312000000
  }
}
```

### action.approved

```json
{
  "id": "evt_1710720100001_app001",
  "type": "action.approved",
  "timestamp": "2026-03-18T10:01:40.000Z",
  "data": {
    "action_id": "act_1710720100000_xyz789",
    "agent_id": "agent_1710720000000_abc123",
    "action": "query",
    "tool": "web_search",
    "gates_passed": 8,
    "gates_total": 8,
    "reputation_delta": 1,
    "audit_hash": "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    "latency_ms": 19
  }
}
```

### action.blocked

```json
{
  "id": "evt_1710720200001_blk001",
  "type": "action.blocked",
  "timestamp": "2026-03-18T10:03:20.000Z",
  "data": {
    "action_id": "act_1710720200000_def456",
    "agent_id": "agent_1710720000000_abc123",
    "action": "transfer",
    "tool": "transfer_funds",
    "blocked_at_gate": "role_auth",
    "reason": "Agent role RESEARCHER not authorized for tool 'transfer_funds'",
    "gates_passed": 1,
    "gates_total": 8,
    "reputation_delta": -2
  }
}
```

### agent.slashed

```json
{
  "id": "evt_1710720300001_sls001",
  "type": "agent.slashed",
  "timestamp": "2026-03-18T10:05:00.000Z",
  "data": {
    "agent_id": "agent_1710720000000_abc123",
    "severity": "high",
    "slash_amount_usdc": "5.00",
    "reason": "Repeated compliance violations detected",
    "gate": "compliance",
    "previous_reputation": 48,
    "new_reputation": 30,
    "total_slash_events": 3
  }
}
```

### reputation.changed

```json
{
  "id": "evt_1710720100002_rep001",
  "type": "reputation.changed",
  "timestamp": "2026-03-18T10:01:40.000Z",
  "data": {
    "agent_id": "agent_1710720000000_abc123",
    "previous_score": 50,
    "new_score": 51,
    "delta": 1,
    "previous_tier": "NOVICE",
    "new_tier": "RELIABLE",
    "tier_changed": true,
    "trigger": "action.approved"
  }
}
```

---

## Signature Verification

Every webhook delivery includes an HMAC-SHA256 signature in the `X-Xorb-Signature` header. Always verify this signature before processing the payload to ensure the request genuinely came from X.orb.

The signature is computed as:

```
HMAC-SHA256(webhook_secret, raw_request_body)
```

The `X-Xorb-Signature` header value has the format:

```
sha256=<hex-encoded HMAC>
```

### Verification in TypeScript (Node.js)

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): boolean {
  const expectedSignature = 'sha256=' + createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')

  // Use timing-safe comparison to prevent timing attacks
  const expected = Buffer.from(expectedSignature)
  const received = Buffer.from(signatureHeader)

  if (expected.length !== received.length) {
    return false
  }

  return timingSafeEqual(expected, received)
}

// Express.js example
import express from 'express'

const app = express()

// IMPORTANT: Use raw body parser for webhook routes to get the raw string
app.post('/webhooks/xorb', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-xorb-signature'] as string
  const rawBody = req.body.toString()

  if (!verifyWebhookSignature(rawBody, signature, process.env.XORB_WEBHOOK_SECRET!)) {
    console.error('Invalid webhook signature')
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const event = JSON.parse(rawBody)

  switch (event.type) {
    case 'action.approved':
      console.log(`Action ${event.data.action_id} approved for agent ${event.data.agent_id}`)
      break
    case 'action.blocked':
      console.log(`Action blocked at gate ${event.data.blocked_at_gate}: ${event.data.reason}`)
      break
    case 'agent.slashed':
      console.log(`Agent ${event.data.agent_id} slashed: ${event.data.slash_amount_usdc} USDC`)
      break
    case 'reputation.changed':
      if (event.data.tier_changed) {
        console.log(`Agent ${event.data.agent_id} tier changed: ${event.data.previous_tier} -> ${event.data.new_tier}`)
      }
      break
  }

  // Respond with 200 to acknowledge receipt
  res.status(200).json({ received: true })
})
```

### Verification in Python (Flask)

```python
import hmac
import hashlib
from flask import Flask, request, jsonify

app = Flask(__name__)

WEBHOOK_SECRET = "whsec_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"


def verify_webhook_signature(raw_body: bytes, signature_header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    # Use hmac.compare_digest for timing-safe comparison
    return hmac.compare_digest(expected, signature_header)


@app.route("/webhooks/xorb", methods=["POST"])
def handle_webhook():
    signature = request.headers.get("X-Xorb-Signature", "")
    raw_body = request.get_data()

    if not verify_webhook_signature(raw_body, signature, WEBHOOK_SECRET):
        return jsonify({"error": "Invalid signature"}), 401

    event = request.get_json()

    if event["type"] == "action.approved":
        print(f"Action {event['data']['action_id']} approved")
    elif event["type"] == "action.blocked":
        print(f"Action blocked at {event['data']['blocked_at_gate']}: {event['data']['reason']}")
    elif event["type"] == "agent.slashed":
        print(f"Agent {event['data']['agent_id']} slashed: {event['data']['slash_amount_usdc']} USDC")
    elif event["type"] == "reputation.changed":
        if event["data"]["tier_changed"]:
            print(f"Tier changed: {event['data']['previous_tier']} -> {event['data']['new_tier']}")

    # Respond with 200 to acknowledge receipt
    return jsonify({"received": True}), 200
```

### Verification in Python (FastAPI)

```python
import hmac
import hashlib
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()

WEBHOOK_SECRET = "whsec_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"


@app.post("/webhooks/xorb")
async def handle_webhook(request: Request):
    raw_body = await request.body()
    signature = request.headers.get("x-xorb-signature", "")

    expected = "sha256=" + hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    event = await request.json()

    match event["type"]:
        case "action.approved":
            print(f"Action {event['data']['action_id']} approved")
        case "action.blocked":
            print(f"Blocked at {event['data']['blocked_at_gate']}")
        case "agent.slashed":
            print(f"Slashed: {event['data']['slash_amount_usdc']} USDC")
        case "reputation.changed":
            print(f"Reputation: {event['data']['previous_score']} -> {event['data']['new_score']}")

    return {"received": True}
```

---

## Retry Policy

If your endpoint does not respond with a `2xx` status code within 10 seconds, X.orb will retry the delivery.

| Attempt | Delay After Failure |
|---------|-------------------|
| 1st retry | 10 seconds |
| 2nd retry | 60 seconds |
| 3rd retry | 300 seconds (5 minutes) |

After 3 failed retries, the delivery is marked as failed.

### Failure Handling

- **Consecutive Failure Threshold:** After **5 consecutive failed deliveries** (across any event types), the webhook subscription is automatically **disabled** (`active: false`).
- When a webhook is disabled, no further events are delivered until you re-enable it.
- You can check the failure count and delivery history via `GET /v1/webhooks` and `GET /v1/webhooks/:id/deliveries`.

### Re-enabling a Disabled Webhook

To re-enable a disabled webhook, delete it and create a new subscription:

```bash
# Delete the disabled webhook
curl -X DELETE https://api.xorb.xyz/v1/webhooks/wh_1710720000000_abc123 \
  -H "x-api-key: xorb_sk_..."

# Create a new subscription
curl -X POST https://api.xorb.xyz/v1/webhooks \
  -H "Content-Type: application/json" \
  -H "x-api-key: xorb_sk_..." \
  -d '{
    "url": "https://your-server.com/webhooks/xorb",
    "event_types": ["action.approved", "action.blocked", "agent.slashed"]
  }'
```

---

## Managing Webhooks

### List All Webhooks

```bash
curl https://api.xorb.xyz/v1/webhooks \
  -H "x-api-key: xorb_sk_..."
```

```json
{
  "webhooks": [
    {
      "id": "wh_1710720000000_abc123",
      "url": "https://your-server.com/webhooks/xorb",
      "event_types": ["action.approved", "action.blocked", "agent.slashed"],
      "active": true,
      "failure_count": 0,
      "last_delivery_at": "2026-03-18T10:01:40.000Z"
    }
  ]
}
```

### View Delivery History

```bash
curl https://api.xorb.xyz/v1/webhooks/wh_1710720000000_abc123/deliveries \
  -H "x-api-key: xorb_sk_..."
```

```json
{
  "deliveries": [
    {
      "event_id": "evt_1710720100001_app001",
      "event_type": "action.approved",
      "delivered_at": "2026-03-18T10:01:40.500Z",
      "status_code": 200,
      "success": true,
      "attempt": 1
    }
  ]
}
```

### Delete a Webhook

```bash
curl -X DELETE https://api.xorb.xyz/v1/webhooks/wh_1710720000000_abc123 \
  -H "x-api-key: xorb_sk_..."
```

```json
{
  "deleted": true
}
```

---

## Best Practices

1. **Always verify signatures.** Never process a webhook payload without verifying the `X-Xorb-Signature` header. Use timing-safe comparison functions.

2. **Respond quickly.** Return a `200` response as soon as possible. Process the event asynchronously (e.g., push to a queue) if your handling logic is slow.

3. **Handle duplicates.** In rare cases, an event may be delivered more than once. Use the `id` field to deduplicate events.

4. **Use HTTPS.** Webhook URLs must use HTTPS. X.orb will not deliver events to HTTP endpoints.

5. **Monitor failures.** Check `GET /v1/webhooks` periodically to ensure your webhooks are active and the failure count is low.

6. **Subscribe to specific events.** Only subscribe to the event types you need to reduce unnecessary traffic.

---

**Questions?** Contact support at contact@xorb.xyz.
