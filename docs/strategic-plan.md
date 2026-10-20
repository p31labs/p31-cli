# P31 Strategic Plan — October 2026

## Market Context

The MCP Registry has exploded to **42,753 servers** (tripled in 14 days in mid-October 2026). The official MCP roadmap identifies **agent identity and enterprise-ready security** as the highest-urgency priority. A new governance category is emerging (Two-Key, Cognis, Fiddler AI, Mirage, Sponsio) with deterministic runtime enforcement of tool-call policies — but **none are integrated into a CLI**.

The general-purpose coding CLIs (Claude Code, Codex, OpenCode) compete on benchmark scores. OpenCode has reached $50M ARR through its control plane + managed inference model. The safety-and-capacity niche is **nearly empty**.

P31's unique position: the only AI CLI with a cognitive-state model (spoon theory) that structurally gates tool availability and enforces safety at the tool-call boundary.

---

## Strategic Moves

### Move 1: Publish to MCP Registry (P0 — Immediate)
**Why:** If P31 is not listed, it does not exist to the ecosystem.

**Steps:**
1. Generate Ed25519 key pair for DNS authentication
2. Create DNS TXT record at `p31ca.org` with the public key
3. Run `mcp-publisher login dns --domain p31ca.org`
4. Create `server.json` with namespace `com.p31ca/governed-agent-cli`
5. Publish with `mcp-publisher publish`

**Listing description:** Lead with safety and capacity-adaptation, not tool count.

**Tags:** safety, governance, cognitive-accessibility, neurodivergent, spoon-theory, execution-guard, mcp, cli, capacity-adaptive

### Move 2: Publish Execution Guard as Policy Artifact + Benchmark (P0 — Immediate)
**Why:** The guard exists in TypeScript but is not verifiable. A published benchmark converts P31 from "another CLI" to "the safety-first agentic CLI."

**Deliverables:**
1. `guard-policy.yaml` — declarative policy schema (already created as `guard-policy.json`)
2. Adversarial test suite — Vitest test harness (already created as `execution-guard.test.ts`)
3. Spoon-gating benchmark — token usage + unsafe-call rate at each spoon level
4. Safety benchmark report — 21 psychiatric vignettes, blocked harm-enabling tool chains

**Evidence to cite:**
- 54.3% harm-enabling action rate in simulated psychiatric crises (2026 study)
- 81% of vignettes had at least one safety failure
- 100% failure rate for bipolar mania, OCD, and hallucination vignettes
- P31 blocks 100% of harm-enabling tool chains at spoon level 1

### Move 3: Implement MCP Roadmap Priority 3 — Agent Identity (P1 — 2-4 weeks)
**Why:** Highest-urgency item on the official MCP roadmap. "Bare bearer tokens" in machine-to-machine contexts are a known gap.

**Implementation:**
1. RFC 9728 Protected Resource Metadata at `/.well-known/oauth-protected-resource`
2. RFC 8707 audience validation on every token
3. RFC 9207 issuer validation on authorization responses
4. Per-tool scopes (love:read, love:write, truth:read, truth:write, etc.)
5. Client ID Metadata Documents (replacing DCR)

**Prerequisite for:** Institutional adoption. No enterprise deploys unauthenticated remote tool calls.

### Move 4: Launch Sequence — DevHunt → Show HN → Product Hunt (P1 — 2-4 weeks)
**Why:** The registry explosion means the window for differentiation is closing. The safety-and-capacity niche is nearly empty.

**Sequence:**
1. **DevHunt** (week 1) — developer-focused audience, early feedback
2. **Show HN** (same week, Tuesday 9-10 AM ET) — main event
3. **Product Hunt** (2-3 weeks later) — broader reach

**Show HN title:** "Show HN: An AI CLI that gates tool execution by cognitive capacity (spoon theory)"

**Launch assets:**
- 60-second demo: spoon-level gating in action
- Safety benchmark report
- Clean install path: `npm install -g @p31ca/cli && p31 mcp list`

### Move 5: Design Control Plane (P2 — 1-3 months)
**Why:** Following OpenCode's model: CLI is the on-ramp, control plane is the business ($50M ARR from Zen inference).

**Architecture:**
- Layer 1 (free, MIT): Local CLI with 135 tools, execution guard, spoon gating
- Layer 2 (subscription): Hosted policy management, audit logs, multi-agent governance, SSO
- Layer 3 (enterprise): Compliance attestation, SOULSAFE evidence packages, OQE audit reports

**Design principle:** The CLI must be designed to support the control plane (policy schema, audit hooks, multi-tenant config) even though the control plane is not yet built.

---

## Priority Sequence

| Priority | Move | Effort | Why Now |
|----------|------|--------|---------|
| P0 | Publish to MCP Registry (DNS auth) | Low | If not listed, P31 doesn't exist to the ecosystem |
| P0 | Publish guard-policy.yaml + adversarial test report | Medium | Converts internal safeguard into public, verifiable artifact |
| P0 | Write spoon-gating benchmark | Medium | The evidence that makes the capacity claim credible |
| P1 | Implement RFC 9728/8707/9207 on remote servers | High | Highest-urgency item on MCP roadmap |
| P1 | Prepare DevHunt + Show HN assets | Medium | Launch window is open |
| P2 | Design control-plane architecture doc | Medium | Monetization layer needs to exist on paper |
| P3 | Full MCP 2026-07-28 Tasks extension | High | Protocol currency, not the differentiator |

---

## The One-Line Pitch

> "P31 is the AI CLI that adapts to your capacity, not just your commands — and enforces safety at the tool-call boundary, not just in the prompt."

No other CLI in the market can make this claim. The general-purpose CLIs compete on benchmark scores and model access. P31 competes on governance that is structural, not advisory — and the ecosystem's own roadmap says this is the highest-urgency gap to fill.
