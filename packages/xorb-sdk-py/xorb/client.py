"""X.orb Python SDK — Client for the Agent Trust Infrastructure API."""

import httpx
from typing import Optional, Any
from .types import Agent, PipelineResult, GateResult, ReputationInfo, WebhookSubscription


class XorbAPIError(Exception):
    """Error from X.orb API."""

    def __init__(self, message: str, status: int, request_id: Optional[str] = None):
        super().__init__(message)
        self.status = status
        self.request_id = request_id


class XorbClient:
    """Client for the X.orb API.

    Usage:
        client = XorbClient(api_url="https://api.xorb.xyz", api_key="xorb_sk_...")

        # Register an agent
        agent = client.agents.register(
            name="research-bot",
            role="RESEARCHER",
            sponsor_address="0x...",
        )

        # Execute action through 8-gate pipeline
        result = client.actions.execute(
            agent_id=agent.agent_id,
            action="query",
            tool="get_balance",
        )

        if result.approved:
            print(f"Approved! Audit hash: {result.audit_hash}")
        else:
            failed = next(g for g in result.gates if not g.passed)
            print(f"Blocked at gate: {failed.gate} — {failed.reason}")
    """

    def __init__(self, api_url: str, api_key: str, timeout: float = 30.0):
        self.base_url = api_url.rstrip("/")
        self.api_key = api_key
        self._http = httpx.Client(
            base_url=self.base_url,
            headers={"x-api-key": api_key, "Content-Type": "application/json"},
            timeout=timeout,
        )
        self.agents = _AgentsAPI(self)
        self.actions = _ActionsAPI(self)
        self.reputation = _ReputationAPI(self)
        self.webhooks = _WebhooksAPI(self)
        self.audit = _AuditAPI(self)
        self.marketplace = _MarketplaceAPI(self)
        self.compliance = _ComplianceAPI(self)
        self.events = _EventsAPI(self)
        self.payments = _PaymentsAPI(self)

    def _request(self, method: str, path: str, json: Any = None) -> dict:
        res = self._http.request(method, path, json=json)
        data = res.json()
        if res.status_code >= 400:
            raise XorbAPIError(
                data.get("error", "Request failed"),
                res.status_code,
                data.get("request_id"),
            )
        return data

    def health(self) -> dict:
        return self._request("GET", "/v1/health")

    def pricing(self) -> dict:
        return self._request("GET", "/v1/pricing")

    def close(self):
        self._http.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


class _AgentsAPI:
    def __init__(self, client: XorbClient):
        self._c = client

    def register(
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
        data = self._c._request("POST", "/v1/agents", json=body)
        return _parse_agent(data["agent"])

    def list(self, sponsor: Optional[str] = None, status: Optional[str] = None) -> tuple[list[Agent], int]:
        """List agents. Returns a tuple of (agents, total_count)."""
        params = []
        if sponsor:
            params.append(f"sponsor={sponsor}")
        if status:
            params.append(f"status={status}")
        qs = "?" + "&".join(params) if params else ""
        data = self._c._request("GET", f"/v1/agents{qs}")
        agents = [_parse_agent(a) for a in data["agents"]]
        count = data.get("count", len(agents))
        return (agents, count)

    def get(self, agent_id: str) -> Agent:
        data = self._c._request("GET", f"/v1/agents/{agent_id}")
        return _parse_agent(data["agent"])

    def pause(self, agent_id: str) -> Agent:
        data = self._c._request("PATCH", f"/v1/agents/{agent_id}", json={"action": "pause"})
        return _parse_agent(data["agent"])

    def resume(self, agent_id: str) -> Agent:
        data = self._c._request("PATCH", f"/v1/agents/{agent_id}", json={"action": "resume"})
        return _parse_agent(data["agent"])

    def revoke(self, agent_id: str) -> Agent:
        data = self._c._request("DELETE", f"/v1/agents/{agent_id}")
        return _parse_agent(data["agent"])


class _ActionsAPI:
    def __init__(self, client: XorbClient):
        self._c = client

    def execute(
        self,
        agent_id: str,
        action: str,
        tool: str,
        params: Optional[dict] = None,
    ) -> PipelineResult:
        body = {"agent_id": agent_id, "action": action, "tool": tool}
        if params:
            body["params"] = params
        data = self._c._request("POST", "/v1/actions/execute", json=body)
        return _parse_pipeline_result(data)

    def batch(self, actions: list[dict]) -> dict:
        return self._c._request("POST", "/v1/actions/batch", json={"actions": actions})


class _ReputationAPI:
    def __init__(self, client: XorbClient):
        self._c = client

    def get(self, agent_id: str) -> ReputationInfo:
        data = self._c._request("GET", f"/v1/reputation/{agent_id}")
        return ReputationInfo(
            agent_id=data["agent_id"],
            score=data["score"],
            tier=data["tier"],
            total_actions=data["total_actions"],
            slash_events=data["slash_events"],
        )

    def leaderboard(self) -> list[dict]:
        data = self._c._request("GET", "/v1/reputation/leaderboard")
        return data["agents"]


class _WebhooksAPI:
    def __init__(self, client: XorbClient):
        self._c = client

    def subscribe(self, url: str, event_types: list[str]) -> WebhookSubscription:
        data = self._c._request("POST", "/v1/webhooks", json={
            "url": url, "event_types": event_types,
        })
        return WebhookSubscription(
            id=data["id"], url=data["url"],
            event_types=data["event_types"],
            secret=data["secret"], active=data["active"],
        )

    def list(self) -> list[dict]:
        data = self._c._request("GET", "/v1/webhooks")
        return data["webhooks"]

    def delete(self, webhook_id: str) -> dict:
        return self._c._request("DELETE", f"/v1/webhooks/{webhook_id}")


class _AuditAPI:
    def __init__(self, client: XorbClient):
        self._c = client

    def get(self, agent_id: str) -> dict:
        return self._c._request("GET", f"/v1/audit/{agent_id}")


class _MarketplaceAPI:
    def __init__(self, client: XorbClient):
        self._c = client

    def create_listing(self, agent_id: str, description: str, **kwargs) -> dict:
        body = {"agent_id": agent_id, "description": description, **kwargs}
        return self._c._request("POST", "/v1/marketplace/listings", json=body)

    def listings(self) -> dict:
        return self._c._request("GET", "/v1/marketplace/listings")

    def hire(self, listing_id: str, escrow_amount_usdc: float) -> dict:
        return self._c._request("POST", "/v1/marketplace/hire", json={
            "listing_id": listing_id, "escrow_amount_usdc": escrow_amount_usdc,
        })


class _ComplianceAPI:
    def __init__(self, client: XorbClient):
        self._c = client

    def report(self, agent_id: str, framework: str = 'eu-ai-act') -> dict:
        return self._c._request("GET", f"/v1/compliance/{agent_id}?framework={framework}")

    def frameworks(self, agent_id: str) -> dict:
        return self._c._request("GET", f"/v1/compliance/{agent_id}/frameworks")


class _EventsAPI:
    def __init__(self, client: XorbClient):
        self._c = client

    def list(self, agent_id: Optional[str] = None, limit: int = 50) -> dict:
        params = [f"limit={limit}"]
        if agent_id:
            params.append(f"agent_id={agent_id}")
        qs = "?" + "&".join(params)
        return self._c._request("GET", f"/v1/events{qs}")

    def stream(self, since: Optional[str] = None, agent_id: Optional[str] = None) -> dict:
        params = []
        if since:
            params.append(f"since={since}")
        if agent_id:
            params.append(f"agent_id={agent_id}")
        qs = "?" + "&".join(params) if params else ""
        return self._c._request("GET", f"/v1/events/stream{qs}")


class _PaymentsAPI:
    def __init__(self, client: XorbClient):
        self._c = client

    def usage(self) -> dict:
        return self._c._request("GET", "/v1/billing/usage")

    def wallet_status(self) -> dict:
        return self._c._request("GET", "/v1/billing/wallet-status")

    def history(self, limit: int = 50) -> dict:
        return self._c._request("GET", f"/v1/billing/payments?limit={limit}")

    def receipt(self, action_id: str) -> dict:
        return self._c._request("GET", f"/v1/billing/payments/{action_id}/receipt")

    def set_spending_caps(self, daily: Optional[int] = None, monthly: Optional[int] = None) -> dict:
        body: dict = {}
        if daily is not None:
            body['daily_spend_cap_usdc'] = daily
        if monthly is not None:
            body['monthly_spend_cap_usdc'] = monthly
        return self._c._request("PUT", "/v1/billing/spending-caps", json=body)


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
        GateResult(
            gate=g["gate"],
            passed=g["passed"],
            reason=g.get("reason"),
            latency_ms=g.get("latency_ms", 0),
        )
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
