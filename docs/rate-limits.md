# X.orb Rate Limits

X.orb enforces rate limits to ensure fair usage and platform stability. Limits vary by tier and are applied per API key.

---

## Tiers

| | Free | Pro | Enterprise |
|---|---|---|---|
| **Monthly Actions** | 1,000 | 50,000 | Custom |
| **Burst Rate** | 10 req/sec | 50 req/sec | Custom |
| **Batch Size** | Up to 100 actions | Up to 100 actions | Up to 1,000 actions |
| **Webhook Subscriptions** | 5 | 25 | Unlimited |
| **Compliance Reports** | 10/month | 100/month | Unlimited |
| **Price** | Free | Pay-per-action (USDC) | Contact sales |

### Free Tier

Every API key receives 1,000 free actions per calendar month. This counter resets at midnight UTC on the 1st of each month. Free tier usage is tracked against paid endpoints only; health checks, pricing lookups, agent listing, and agent lifecycle operations (pause, resume, revoke) are always free and do not count toward the limit.

### Pro Tier

After the free tier is exhausted, the API returns HTTP 402 with x402 payment instructions. Each request is paid individually in USDC via the `x-payment` header. There is no subscription or account upgrade required; simply include a valid x402 payment to continue making requests beyond the free tier.

### Enterprise Tier

For organizations requiring custom rate limits, dedicated support, SLA guarantees, or a Data Processing Agreement, contact contact@xorb.xyz.

---

## Rate Limit Headers

Every API response includes rate limit headers:

| Header | Description | Example |
|--------|-------------|---------|
| `X-RateLimit-Limit` | Maximum requests permitted in the current window | `10` |
| `X-RateLimit-Remaining` | Number of requests remaining in the current window | `7` |
| `X-RateLimit-Reset` | Unix timestamp (seconds) when the current window resets | `1710720060` |

When the free tier is in effect, an additional header is included:

| Header | Description | Example |
|--------|-------------|---------|
| `x-free-tier-remaining` | Free tier actions remaining for the current month | `873` |

---

## Rate Limit Behavior

### Burst Rate Limiting

Burst rate limits are enforced on a per-second sliding window basis. If you exceed the burst rate for your tier, you will receive a `429 Too Many Requests` response.

### Monthly Action Limits (Free Tier)

When the monthly free tier limit is reached, the API returns a `402 Payment Required` response with payment instructions instead of a `429`.

### Free Endpoints

The following endpoints are never rate-limited by the monthly action counter and are always free:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/health` | GET | Health check |
| `/v1/pricing` | GET | Pricing information |
| `/v1/auth/keys` | POST | Generate API key |
| `/v1/auth/keys/rotate` | POST | Rotate API key |
| `/v1/agents` | GET | List agents |
| `/v1/agents/:id` | PATCH | Pause/resume/renew agent |
| `/v1/agents/:id` | DELETE | Revoke agent |
| `/v1/events` | GET | List events |

These endpoints are still subject to burst rate limiting to prevent abuse.

---

## When You Are Rate Limited

### HTTP 429 Response

```json
{
  "error": "Rate limit exceeded. Try again in 3 seconds.",
  "request_id": "req_1710720000001_abc123"
}
```

**Response headers:**

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1710720063
Retry-After: 3
```

### HTTP 402 Response (Free Tier Exhausted)

```json
{
  "error": "Payment Required",
  "status": 402,
  "details": {
    "endpoint": "POST /v1/actions/execute",
    "price_usdc": 0.005,
    "free_tier_exhausted": true,
    "free_tier_limit": 1000,
    "free_tier_used": 1000,
    "accepts": [
      { "network": "eip155:137", "asset": "USDC", "amount": "5000" },
      { "network": "eip155:8453", "asset": "USDC", "amount": "5000" }
    ]
  }
}
```

---

## Handling Rate Limits

### Strategy 1: Wait and Retry

Read the `Retry-After` header and wait before retrying. The official SDKs handle this automatically with exponential backoff.

```typescript
// TypeScript — manual retry with Retry-After
async function executeWithRetry(client: XorbClient, params: ExecuteActionParams, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await client.actions.execute(params)
    } catch (err) {
      if (err instanceof XorbAPIError && err.status === 429) {
        // The SDK already retries 5xx errors, but for 429 we handle it manually
        const retryAfter = 2 ** attempt // exponential backoff
        console.log(`Rate limited. Retrying in ${retryAfter}s...`)
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
        continue
      }
      throw err
    }
  }
  throw new Error('Max retries exceeded')
}
```

```python
# Python — manual retry with backoff
import time
from xorb import XorbClient, XorbAPIError

def execute_with_retry(client: XorbClient, agent_id: str, action: str, tool: str, max_retries: int = 3):
    for attempt in range(max_retries):
        try:
            return client.actions.execute(agent_id=agent_id, action=action, tool=tool)
        except XorbAPIError as e:
            if e.status == 429:
                retry_after = 2 ** attempt
                print(f"Rate limited. Retrying in {retry_after}s...")
                time.sleep(retry_after)
                continue
            raise
    raise Exception("Max retries exceeded")
```

### Strategy 2: Use Batch Endpoints

Reduce request count by batching multiple actions into a single request:

```bash
curl -X POST https://api.xorb.xyz/v1/actions/batch \
  -H "Content-Type: application/json" \
  -H "x-api-key: xorb_sk_..." \
  -d '{
    "actions": [
      { "agent_id": "agent_1", "action": "query", "tool": "web_search" },
      { "agent_id": "agent_1", "action": "query", "tool": "db_lookup" },
      { "agent_id": "agent_1", "action": "query", "tool": "file_read" }
    ]
  }'
```

This counts as 1 HTTP request (for burst rate limiting) but 3 actions (for monthly action counting). Each action in the batch is priced at $0.003 USDC instead of $0.005.

### Strategy 3: Upgrade to Pro or Enterprise

If you consistently exceed the free tier, pay per action via x402 (Pro tier) or contact contact@xorb.xyz for custom Enterprise limits.

---

## Pricing Per Endpoint

| Endpoint | Price (USDC) | Description |
|----------|-------------|-------------|
| `POST /v1/agents` | $0.10 | Agent registration |
| `POST /v1/actions/execute` | $0.005 | Per-action gate check |
| `POST /v1/actions/batch` | $0.003 | Per-action batch gate check |
| `GET /v1/reputation/:id` | $0.001 | Reputation lookup |
| `POST /v1/marketplace/hire` | $0.05 | Marketplace hire initiation |
| `GET /v1/audit/:id` | $0.01 | Audit log access |
| `POST /v1/webhooks` | $0.10 | Webhook subscription |
| `GET /v1/compliance/:id` | $1.00 | Compliance report generation |

Current pricing is always available at `GET /v1/pricing`.

---

## FAQ

**Q: Does the free tier reset if I rotate my API key?**
A: No. Free tier usage is tracked per sponsor wallet address, not per API key. Rotating your key does not reset the counter.

**Q: Are rate limits per key or per IP?**
A: Rate limits are per API key, not per IP address.

**Q: Do batch actions count as 1 action or N actions toward the monthly limit?**
A: N actions. Each action in the batch is counted individually toward the monthly limit.

**Q: What happens if I hit the burst limit and the monthly limit at the same time?**
A: The 402 Payment Required response takes precedence over 429 Too Many Requests.

**Q: Can I pre-purchase actions?**
A: Not currently. The x402 protocol is pay-per-action. Contact contact@xorb.xyz for volume pricing on Enterprise plans.

---

**Questions?** Contact support at contact@xorb.xyz.
