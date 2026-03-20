"""X.orb Python SDK — Async Client for the Agent Trust Infrastructure API."""

import httpx
from typing import Optional, Any
from .types import Agent, PipelineResult, GateResult, ReputationInfo, WebhookSubscription
from .client import XORB_DEFAULT_API_URL, XORB_FALLBACK_API_URL


class XorbAPIError(Exception):
    """Error from X.orb API."""

    def __init__(self, message: str, status: int, request_id: Optional[str] = None):
        super().__init__(message)
        self.status = status
        self.request_id = request_id


class AsyncXorbClient:
    """Async client for the X.orb API.

    Usage:
        # Web3-native: defaults to x.orb (HNS gateway), falls back to api.xorb.xyz
        async with AsyncXorbClient(api_key="xorb_sk_...") as client:
            agent = await client.agents.register(
                name="research-bot",
                role="RESEARCHER",
                sponsor_address="0x...",
            )
            result = await client.actions.execute(
                agent_id=agent.agent_id,
                action="query",
                tool="get_balance",
            )
    """

    def __init__(
        self,
        api_key: str,
        api_url: Optional[str] = None,
        timeout: float = 30.0,
        disable_fallback: bool = False,
    ):
        self.base_url = (api_url or XORB_DEFAULT_API_URL).rstrip("/")
        self._fallback_url = None if disable_fallback else XORB_FALLBACK_API_URL
        self.api_key = api_key
        self._timeout = timeout
        self._http = httpx.AsyncClient(
            base_url=self.base_url,
            headers={"x-api-key": api_key, "Content-Type": "application/json"},
            timeout=timeout,
        )
        self.agents = _AsyncAgentsAPI(self)
        self.actions = _AsyncActionsAPI(self)
        self.reputation = _AsyncReputationAPI(self)
        self.webhooks = _AsyncWebhooksAPI(self)
        self.audit = _AsyncAuditAPI(self)
        self.marketplace = _AsyncMarketplaceAPI(self)
        self.compliance = _AsyncComplianceAPI(self)
        self.events = _AsyncEventsAPI(self)
        self.payments = _AsyncPaymentsAPI(self)

    async def _request(self, method: str, path: str, json: Any = None) -> dict:
        try:
            res = await self._http.request(method, path, json=json)
            data = res.json()
            if res.status_code >= 400:
                raise XorbAPIError(
                    data.get("error", "Request failed"),
                    res.status_code,
                    data.get("request_id"),
                )
            return data
        except (httpx.ConnectError, httpx.TimeoutException):
            # Primary URL unreachable — try fallback (api.xorb.xyz)
            if self._fallback_url and self.base_url != self._fallback_url:
                async with httpx.AsyncClient(
                    base_url=self._fallback_url,
                    headers={"x-api-key": self.api_key, "Content-Type": "application/json"},
                    timeout=self._timeout,
                ) as fallback:
                    res = await fallback.request(method, path, json=json)
                    data = res.json()
                    if res.status_code >= 400:
                        raise XorbAPIError(
                            data.get("error", "Request failed"),
                            res.status_code,
                            data.get("request_id"),
                        )
                    return data
            raise

    async def health(self) -> dict:
        return await self._request("GET", "/v1/health")

    async def pricing(self) -> dict:
        return await self._request("GET", "/v1/pricing")

    async def close(self):
        await self._http.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self.close()


class _AsyncAgentsAPI:
    def __init__(self, client: AsyncXorbClient):
        self._c = client

    async def register(
        self,
        name: str,
        role: str,
        sponsor_address: str,
        stake_bond: Optional[str] = None,
        expiry_days: Optional[int] = None,
        description: Optional[str] = None,
    ) -> Agent:
        body: dict = {"name": name, "role": role, "sponsor_address": sponsor_address}
        if stake_bond:
            body["stake_bond"] = stake_bond
        if expiry_days is not None:
            body["expiry_days"] = expiry_days
        if description:
            body["description"] = description
        data = await self._c._request("POST", "/v1/agents", json=body)
        return _parse_agent(data["agent"])

    async def list(self, sponsor: Optional[str] = None, status: Optional[str] = None) -> tuple[list[Agent], int]:
        params = []
        if sponsor:
            params.append(f"sponsor={sponsor}")
        if status:
            params.append(f"status={status}")
        qs = "?" + "&".join(params) if params else ""
        data = await self._c._request("GET", f"/v1/agents{qs}")
        agents = [_parse_agent(a) for a in data["agents"]]
        return (agents, data.get("count", len(agents)))

    async def get(self, agent_id: str) -> Agent:
        data = await self._c._request("GET", f"/v1/agents/{agent_id}")
        return _parse_agent(data["agent"])

    async def pause(self, agent_id: str) -> Agent:
        data = await self._c._request("PATCH", f"/v1/agents/{agent_id}", json={"action": "pause"})
        return _parse_agent(data["agent"])

    async def resume(self, agent_id: str) -> Agent:
        data = await self._c._request("PATCH", f"/v1/agents/{agent_id}", json={"action": "resume"})
        return _parse_agent(data["agent"])

    async def revoke(self, agent_id: str) -> Agent:
        data = await self._c._request("DELETE", f"/v1/agents/{agent_id}")
        return _parse_agent(data["agent"])


class _AsyncActionsAPI:
    def __init__(self, client: AsyncXorbClient):
        self._c = client

    async def execute(self, agent_id: str, action: str, tool: str, params: Optional[dict] = None) -> PipelineResult:
        body = {"agent_id": agent_id, "action": action, "tool": tool}
        if params:
            body["params"] = params
        data = await self._c._request("POST", "/v1/actions/execute", json=body)
        return _parse_pipeline_result(data)

    async def batch(self, actions: list[dict]) -> dict:
        return await self._c._request("POST", "/v1/actions/batch", json={"actions": actions})


class _AsyncReputationAPI:
    def __init__(self, client: AsyncXorbClient):
        self._c = client

    async def get(self, agent_id: str) -> ReputationInfo:
        data = await self._c._request("GET", f"/v1/reputation/{agent_id}")
        return ReputationInfo(
            agent_id=data["agent_id"], score=data["score"], tier=data["tier"],
            total_actions=data["total_actions"], slash_events=data["slash_events"],
        )

    async def leaderboard(self) -> list[dict]:
        data = await self._c._request("GET", "/v1/reputation/leaderboard")
        return data["agents"]


class _AsyncWebhooksAPI:
    def __init__(self, client: AsyncXorbClient):
        self._c = client

    async def subscribe(self, url: str, event_types: list[str]) -> WebhookSubscription:
        data = await self._c._request("POST", "/v1/webhooks", json={"url": url, "event_types": event_types})
        return WebhookSubscription(id=data["id"], url=data["url"], event_types=data["event_types"], secret=data["secret"], active=data["active"])

    async def list(self) -> list[dict]:
        data = await self._c._request("GET", "/v1/webhooks")
        return data["webhooks"]

    async def delete(self, webhook_id: str) -> dict:
        return await self._c._request("DELETE", f"/v1/webhooks/{webhook_id}")


class _AsyncAuditAPI:
    def __init__(self, client: AsyncXorbClient):
        self._c = client

    async def get(self, agent_id: str) -> dict:
        return await self._c._request("GET", f"/v1/audit/{agent_id}")


class _AsyncMarketplaceAPI:
    def __init__(self, client: AsyncXorbClient):
        self._c = client

    async def create_listing(self, agent_id: str, description: str, **kwargs) -> dict:
        body = {"agent_id": agent_id, "description": description, **kwargs}
        return await self._c._request("POST", "/v1/marketplace/listings", json=body)

    async def listings(self) -> dict:
        return await self._c._request("GET", "/v1/marketplace/listings")

    async def hire(self, listing_id: str, escrow_amount_usdc: float) -> dict:
        return await self._c._request("POST", "/v1/marketplace/hire", json={
            "listing_id": listing_id, "escrow_amount_usdc": escrow_amount_usdc,
        })


class _AsyncComplianceAPI:
    def __init__(self, client: AsyncXorbClient):
        self._c = client

    async def report(self, agent_id: str, framework: str = "eu-ai-act") -> dict:
        return await self._c._request("GET", f"/v1/compliance/{agent_id}?format={framework}")

    async def frameworks(self, agent_id: str) -> dict:
        return await self._c._request("GET", f"/v1/compliance/{agent_id}/frameworks")


class _AsyncEventsAPI:
    def __init__(self, client: AsyncXorbClient):
        self._c = client

    async def list(self, agent_id: Optional[str] = None, limit: int = 50) -> dict:
        params = [f"limit={limit}"]
        if agent_id:
            params.append(f"agent_id={agent_id}")
        qs = "?" + "&".join(params)
        return await self._c._request("GET", f"/v1/events{qs}")

    async def stream(self, since: Optional[str] = None, agent_id: Optional[str] = None) -> dict:
        params = []
        if since:
            params.append(f"since={since}")
        if agent_id:
            params.append(f"agent_id={agent_id}")
        qs = "?" + "&".join(params) if params else ""
        return await self._c._request("GET", f"/v1/events/stream{qs}")


class _AsyncPaymentsAPI:
    def __init__(self, client: AsyncXorbClient):
        self._c = client

    async def usage(self) -> dict:
        return await self._c._request("GET", "/v1/billing/usage")

    async def wallet_status(self) -> dict:
        return await self._c._request("GET", "/v1/billing/wallet-status")

    async def history(self, limit: int = 50) -> dict:
        return await self._c._request("GET", f"/v1/billing/payments?limit={limit}")

    async def receipt(self, action_id: str) -> dict:
        return await self._c._request("GET", f"/v1/billing/payments/{action_id}/receipt")

    async def set_spending_caps(self, daily: Optional[int] = None, monthly: Optional[int] = None) -> dict:
        body: dict = {}
        if daily is not None:
            body['daily_spend_cap_usdc'] = daily
        if monthly is not None:
            body['monthly_spend_cap_usdc'] = monthly
        return await self._c._request("PUT", "/v1/billing/spending-caps", json=body)


def _parse_agent(data: dict) -> Agent:
    return Agent(
        agent_id=data.get("agentId", ""),
        name=data.get("name", ""),
        role=data.get("role", ""),
        sponsor_address=data.get("sponsorAddress", ""),
        session_wallet_address=data.get("sessionWalletAddress", ""),
        stake_bond=data.get("stakeBond", "0"),
        reputation=data.get("reputation", 0),
        reputation_tier=data.get("reputationTier", "NOVICE"),
        status=data.get("status", "active"),
        created_at=data.get("createdAt", 0),
        expires_at=data.get("expiresAt", 0),
        last_active_at=data.get("lastActiveAt", 0),
        total_actions_executed=data.get("totalActionsExecuted", 0),
        slash_events=data.get("slashEvents", 0),
        description=data.get("description", ""),
    )


def _parse_pipeline_result(data: dict) -> PipelineResult:
    gates = [
        GateResult(gate=g["gate"], passed=g["passed"], reason=g.get("reason"), latency_ms=g.get("latency_ms", 0))
        for g in data.get("gates", [])
    ]
    return PipelineResult(
        action_id=data.get("action_id", ""),
        agent_id=data.get("agent_id", ""),
        approved=data.get("approved", False),
        gates=gates,
        reputation_delta=data.get("reputation_delta", 0),
        audit_hash=data.get("audit_hash", ""),
        timestamp=data.get("timestamp", ""),
        latency_ms=data.get("latency_ms", 0),
    )
