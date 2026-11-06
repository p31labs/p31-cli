# P31 Control Plane — Architecture Design

## Overview
The control plane is the monetization layer above the free CLI. Following
OpenCode's model: the CLI is the on-ramp, the control plane is the business.

## Three Layers

### Layer 1: Free CLI (MIT License)
- Local tool surface (135 tools)
- Execution guard (runtime safety)
- Spoon-level gating (capacity adaptation)
- Progressive discovery (context economics)
- Compound orchestrators (programmatic tool calling)
- Tool fingerprinting (OWASP MCP03 defense)

**Monetization:** Adoption and trust. Free forever.

### Layer 2: Hosted Control Plane (Subscription)
- Central policy management (guard-policy.yaml sync)
- Audit logs (all tool calls, decisions, escalations)
- Multi-agent governance (shared policies across team)
- SSO / RBAC (role-based tool access)
- Spoon-level analytics (team capacity dashboards)
- Webhook integrations (Slack, PagerDuty for crisis escalations)

**Monetization:** Per-seat or per-org subscription ($X/user/month)

### Layer 3: Enterprise Compliance (Annual Contract)
- SOULSAFE evidence packages (audit-ready compliance reports)
- OQE (Operational Quality Evidence) attestation
- Custom policy development (domain-specific guard rules)
- Dedicated support (SLA-backed)
- On-premise deployment option

**Monetization:** Annual contract ($X/org/year)

## Technical Architecture

```
┌─────────────────────────────────────────────────┐
│  Layer 3: Enterprise Compliance                  │
│  SOULSAFE evidence, OQE attestation, custom      │
│  policies, on-premise deployment                  │
├─────────────────────────────────────────────────┤
│  Layer 2: Hosted Control Plane                   │
│  Policy sync, audit logs, RBAC, analytics,       │
│  webhooks, multi-agent governance                │
├─────────────────────────────────────────────────┤
│  Layer 1: Free CLI (@p31ca/cli)                   │
│  135 tools, execution guard, spoon gating,       │
│  progressive discovery, fingerprinting            │
└─────────────────────────────────────────────────┘
```

## CLI → Control Plane Interface
The CLI communicates with the control plane via:
1. Policy sync: `GET /api/policy` returns the org's guard-policy.yaml
2. Audit push: `POST /api/audit` sends tool-call logs
3. Spoon telemetry: `POST /api/telemetry` sends capacity data (opt-in)
4. Auth: OAuth 2.1 with per-org scopes

## Revenue Model
Following OpenCode's trajectory:
- CLI drives adoption (free, open-source)
- Control plane drives revenue (subscription)
- Inference drives scale (token margin on managed models)
- Compliance drives enterprise (annual contracts)

OpenCode's Zen inference hit $50M ARR in 5-6 months. P31's control plane
targets the governance niche that general-purpose CLIs don't serve.
