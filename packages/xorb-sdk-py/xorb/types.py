from dataclasses import dataclass, field
from typing import Optional, Any


@dataclass
class Agent:
    agent_id: str
    name: str
    role: str
    sponsor_address: str
    session_wallet_address: str
    stake_bond: str
    reputation: int
    reputation_tier: str
    status: str
    created_at: int
    expires_at: int
    last_active_at: int
    total_actions_executed: int
    slash_events: int
    description: str


@dataclass
class GateResult:
    gate: str
    passed: bool
    reason: Optional[str] = None
    latency_ms: int = 0


@dataclass
class PipelineResult:
    action_id: str
    agent_id: str
    approved: bool
    gates: list[GateResult]
    reputation_delta: int
    audit_hash: str
    timestamp: str
    latency_ms: int


@dataclass
class ReputationInfo:
    agent_id: str
    score: int
    tier: str
    total_actions: int
    slash_events: int


@dataclass
class WebhookSubscription:
    id: str
    url: str
    event_types: list[str]
    secret: str
    active: bool
