# P31 Parallel Path Runbook — October 2026

## Overview

Five independent tracks that can advance in parallel. No track blocks another. Each track has a clear completion signal and verification step.

| Track | Name | Owner | Blocking deps | Target |
|-------|------|-------|---------------|--------|
| A | Agent Skills in npm package | Package | None | 48h |
| B | MCP Registry governance listing | Registry | None (DNS propagation independent) | 72h |
| C | Signed, hash-chained guard decisions | Safety | None | 1 week |
| D | Show HN launch | Marketing | A, C (for demo assets) | Tuesday 9 AM ET |
| E | OIDC Trusted Publishing | CI | None | 24h |

---

## Track A — Ship Agent Skills Inside @p31ca/cli

**Research basis:** Agent Skills crossed 351,000 published skills by March 2026. The convention is a `skills/` directory in the npm package, one subdirectory per skill containing a `SKILL.md` with YAML frontmatter + Markdown instructions. `skills-npm` and `npm-skills` provide extraction tooling. The primary benefit is version alignment: `npm update @p31ca/cli` updates both the tool and its skills together.

### A1 — Create the directory structure

```bash
cd /home/p31/p31-cli
mkdir -p skills/assess-capacity skills/safe-execution skills/love-ledger skills/soulsafe skills/progressive-discovery
```

### A2 — Write each SKILL.md

Each file uses YAML frontmatter (`name`, `description`, `allowed-tools`) followed by Markdown instructions.

**skills/assess-capacity/SKILL.md:**
```markdown
---
name: assess-capacity
description: Use the P31 assess_capacity compound tool to determine whether the user can work on a task right now, based on spoon level and crisis signals. Activate when the user asks "can I work on this?" or "am I okay to continue?"
allowed-tools: assess_capacity, oasis_status, time_estimate, crisis_check
---

# Assess Capacity

Call `assess_capacity` with the task description and complexity. It returns a `verdict` with `mode` (full / reduced / rest), `estimated_minutes`, and `crisis_flags`, plus a `recommended_block` if work is advisable.

Do not call `oasis_status`, `time_estimate`, and `crisis_check` separately. `assess_capacity` runs all three internally and returns a compact verdict.

If `mode` is `rest`, suggest `grounding_54321` and do not propose work.
```

**skills/safe-execution/SKILL.md:**
```markdown
---
name: safe-execution
description: Understand when the P31 execution guard allows, blocks, or escalates mutating tool calls. Activate before calling oasis_execute, love_anchor, truth_register_fact, or design_expert_ephemeralize.
allowed-tools: oasis_execute, love_anchor, truth_register_fact, design_expert_ephemeralize
---

# Safe Execution

The execution guard runs before every mutating tool call. It evaluates spoon level and recent crisis signals against `guard-policy.json`.

- **Blocked**: shell execution (`oasis_execute`) at spoon level ≤ 1. The guard returns `{ status: "blocked" }` and suggests a read-only alternative.
- **Elicitation required**: mutating tools when crisis signals are active. The client must confirm with the user before resubmission.
- **Allowed**: all other cases.

Never bypass the guard by calling a different tool to achieve the same effect.
```

**skills/love-ledger/SKILL.md:**
```markdown
---
name: love-ledger
description: Read and write LOVE ledger entries via the P31 MCP tools. Activate when the user asks about LOVE balance, care attestation, or on-chain anchoring.
allowed-tools: love_status, love_balance, love_sync, love_anchor
---

# LOVE Ledger

Read operations: `love_status`, `love_balance`, `love_sync`. These are safe at any spoon level.

Write operation: `love_anchor` anchors a ledger entry hash on Base Sepolia. It is guarded: at spoon level ≤ 2 it requires elicitation, and it is blocked if crisis signals are active.

Always read `love_status` before proposing an anchor, and explain the transaction hash and explorer link after a successful anchor.
```

**skills/soulsafe/SKILL.md:**
```markdown
---
name: soulsafe
description: Use the P31 SOULSAFE 3-gate verification protocol for institutional-grade change verification. Activate when the user asks for a formal audit, compliance evidence, or a deploy-blocking verdict.
allowed-tools: soulsafe_run_protocol, soulsafe_tagout, soulsafe_severity
---

# SOULSAFE 3-Gate Protocol

Run `soulsafe_run_protocol` with the change description. It evaluates the change through Gate 1 (self-review), Gate 2 (cross-review with information barrier), and Gate 3 (architect verification), and returns a `verdict` of `CLEARED` or `DEPLOY BLOCKED`.

Critical findings block deployment. High findings block deployment until fixed.
```

**skills/progressive-discovery/SKILL.md:**
```markdown
---
name: progressive-discovery
description: Find the right P31 tool without loading all 135 tool definitions into context. Activate when you are unsure which P31 tool to call.
allowed-tools: search_tools, get_tool_details
---

# Progressive Discovery

Call `search_tools` with a natural-language query and optional category filter. It returns tool names and one-line descriptions only.

Then call `get_tool_details` with the exact tool name to fetch the full `inputSchema` and `outputSchema`.

Only after inspecting the schema should you call the tool itself.

Categories available: oasis, love, cognitive, spaceship, ground-truth, marge, soulsafe, bob, component, design, discovery, compound.
```

### A3 — Update package.json files array

```jsonc
"files": ["dist", "tokens", "docs", "skills", "server.json"]
```

### A4 — Add extraction script

```jsonc
"scripts": {
  "skills:extract": "npm-skills extract --skip-production --override"
}
```

### A5 — Verify

```bash
npm run build
npm pack --dry-run 2>&1 | grep -c "skills/"
# Expected: at least 5 SKILL.md entries
```

### Completion signal
`npm pack --dry-run` shows 5+ SKILL.md files in the tarball. Published version includes the `skills/` directory.

---

## Track B — MCP Registry Governance Listing

**Research basis:** The registry requires domain-based authentication for a `com.*` namespace. The `mcp-publisher login dns` command generates a TXT record from an Ed25519 key pair; the private key signs the login, and the TXT record proves domain ownership. The private key must correspond to a TXT record at the domain apex.

### B1 — Generate the Ed25519 key pair

```bash
cd /home/p31/p31-cli
openssl genpkey -algorithm Ed25519 -out mcp-private-key.pem
```

### B2 — Generate the TXT record

```bash
PUBLIC_KEY="$(openssl pkey -in mcp-private-key.pem -pubout -outform DER | tail -c 32 | base64)"
echo "p31ca.org. IN TXT \"v=MCPv1; k=ed25519; p=${PUBLIC_KEY}\""
```

### B3 — Publish the TXT record

Add the TXT record at the p31ca.org domain apex via the DNS provider. Wait for propagation. Verify:

```bash
dig p31ca.org TXT +short
```

### B4 — Install mcp-publisher

```bash
curl -fsSL "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_linux_amd64.tar.gz" | tar xz
chmod +x mcp-publisher
```

### B5 — Authenticate

```bash
./mcp-publisher login dns --domain p31ca.org --private-key "$(cat mcp-private-key.pem)"
```

### B6 — Verify server.json

The name must be `com.p31ca/governed-agent-cli` in reverse-DNS form. The description should lead with the governance and capacity claim. The `repository.url` should point to the GitHub repo.

### B7 — Publish

```bash
./mcp-publisher publish
```

### B8 — Verify

```bash
curl -s https://registry.modelcontextprotocol.io/servers/com.p31ca/governed-agent-cli | jq '.name, .description'
```

### B9 — Secure the private key

Move `mcp-private-key.pem` to a secrets manager or GitHub Actions secret (`MCP_PRIVATE_KEY`) for CI-based re-publishing. Add `mcp-private-key.pem` to `.gitignore`.

### Completion signal
`curl https://registry.modelcontextprotocol.io/servers/com.p31ca/governed-agent-cli` returns the server metadata with name, description, and package info.

---

## Track C — Signed, Hash-Chained Guard Decisions

**Research basis:** The standard pattern for tamper-evident audit logs is SHA-256 hash chaining plus Ed25519 signatures per entry. The chain anchors at a genesis entry whose `previous_hash` is 64 zeros (nexuscone convention). Every subsequent entry's `previous_hash` equals the prior entry's `entry_hash`. The `entry_hash` is the SHA-256 of the canonical JSON of the entry's identifying fields, with sorted keys and the signature field excluded before hashing. The `chainproof` library implements exactly this pattern for TypeScript: UUIDv7 id, monotonic seq, dataHash, prevHash, and an Ed25519 signature over the canonical JSON.

### C1 — Define the decision record schema

Extend `src/safety/execution-guard.ts` to emit a record for every decision:

```typescript
interface GuardDecisionRecord {
  id: string;              // UUIDv7, time-ordered
  seq: number;             // monotonic
  timestamp: string;       // ISO 8601
  tool: string;
  policy_version: string;  // e.g. "2026.10.1"
  governed_state: {
    spoons: number;
    crisis_flags: number;
    fetched_at: string;
  };
  verdict: 'allowed' | 'blocked' | 'elicitation_required';
  reason?: string;
  prev_hash: string;       // SHA-256 of previous record's canonical bytes
  data_hash: string;       // SHA-256 of this record's canonical JSON (excluding prev_hash, data_hash, signature)
  signature: string;       // Ed25519 over data_hash
}
```

### C2 — Implement canonical serialization

Sort keys, exclude `signature` before hashing and signing, use a deterministic JSON serializer. This matches the chainproof research specification: "Entries are serialized with sorted keys and the signature field excluded before hashing and signing."

### C3 — Anchor the genesis entry

`previous_hash` for the first entry is `"0".repeat(64)`, matching the nexuscone genesis convention.

### C4 — Reuse the existing Ed25519 identity

P31 already has sovereign-id with Ed25519 signing. Reuse that key pair for guard decision signatures. The public key can be published as part of the package metadata or a `guard://pubkey` resource so external auditors can verify the chain.

### C5 — Append to a local append-only log

Write each record to `~/.p31/guard-audit.jsonl` (JSON Lines, one record per line). The file is append-only; never rewrite a line.

### C6 — Add a verification function

```typescript
export function verifyGuardChain(
  entries: GuardDecisionRecord[],
  publicKey: string
): { valid: boolean; lastValidSeq: number; error?: string }
```

Walk the chain end-to-end: recompute `data_hash`, verify the Ed25519 signature, confirm `prev_hash` matches the prior `data_hash`. Return the last valid sequence number and the first failure point.

### C7 — Add a guard://audit resource

Add to the MCP bridge a `guard://audit` resource that returns the last N decision records plus the chain verification result. This makes the audit trail inspectable by the agent and by external reviewers.

### C8 — Test with adversarial sequences

Extend `tests/unit/execution-guard.test.ts` to cover:

- A valid chain of 10 decisions verifies.
- Tampering with `verdict` in entry 3 breaks verification at seq 3.
- Deleting entry 5 breaks verification at seq 6 (prev_hash mismatch).
- Reordering entries breaks the chain.
- A forged entry without the private key fails signature verification.

### Completion signal
`verifyGuardChain()` returns `{ valid: true }` for a 10-entry chain. Tamper tests detect modification at the correct sequence number.

---

## Track D — Show HN Launch

**Research basis:** Show HN timing is Tuesday–Thursday, with the strongest windows at 6:00–8:00 AM ET (before the front page fills) or 9:00–11:00 AM ET (peak East Coast plus late EU). The first two hours determine everything: HN's ranking formula is `upvotes / (age_in_hours + 2)^1.8`. The title must state what the tool does in plain English. The project must be tryable within a minute. The community punishes marketing.

### D1 — Finalize the title

Recommended: **"Show HN: An AI CLI that gates tool execution by cognitive capacity (spoon theory)"**

This states the mechanism (gating tool execution), the domain (cognitive capacity), and the personal origin (spoon theory). It is concrete and non-promotional.

### D2 — Prepare the 60-second demo

The demo must show:

1. `npm install -g @p31ca/cli`
2. `p31 mcp list` returning 135 tools.
3. Set spoon level to 1 (or equivalent).
4. Attempt `oasis_execute` (shell) — the guard blocks it and suggests `grounding_54321`.
5. Set spoon level to 5 — the same call is allowed.

Record as an asciinema or a short GIF. The blocking moment is the thesis in one frame.

### D3 — Prepare the founder comment

Lead with the personal pain point: the moment the author realized that a coding agent with shell access at spoon level 1 is a safety hazard, not a productivity tool. Then link to:

- The benchmark: 89% token reduction at spoon level 1 vs full surface.
- The guard policy schema: `src/safety/guard-policy.json`.
- The adversarial test results: 10 tests covering blocked and escalated calls.

Do not lead with the feature list. The HN audience responds to "I built this because I needed it and it didn't exist".

### D4 — Prepare the README for one-minute tryability

The README should open with:

```bash
npm install -g @p31ca/cli
p31 --version
p31 mcp list
```

Then a short "Why this exists" section (3–4 sentences), then the spoon-gating demo, then the guard policy link. No waitlists, no sign-up pages.

### D5 — Launch at 6:00–8:00 AM ET on a Tuesday

Be present for the first 4 hours. Reply to every comment, especially criticism. Do not argue; clarify and thank. The HN community rewards engagement and punishes defensiveness.

### D6 — Cross-post at 8:00 AM ET

Twitter/X thread, then LinkedIn at 9:00 AM ET, then Dev.to at 10:00 AM ET, then Reddit (r/SideProject and niche subs) at 12:00 PM ET. Do not post Product Hunt on the same day — give it its own day.

### Completion signal
Launch thread posted Tuesday 6–8 AM ET. First 2 hours monitored. Founder comment posted within 5 minutes of submission.

---

## Track E — OIDC Trusted Publishing

**Research basis:** npm retired classic publish tokens in late 2025. Trusted Publishing replaces them with short-lived OIDC credentials scoped to the exact repo, workflow file, and environment. Three pieces are required: a release workflow with `id-token: write`, a trust configuration on the package itself, and npm >= 11.15.0 in CI (GitHub-hosted runners ship npm 10.9.8, which has no OIDC code path).

### E1 — Verify the workflow

`.github/workflows/ci.yml` should have:

```yaml
permissions:
  id-token: write
  contents: read
```

And the publish step should be:

```yaml
- name: Upgrade npm for OIDC
  run: npm install -g npm@^11.15.0
- name: Publish
  run: npm publish --provenance --access public
```

**Critical:** Do not set `registry-url` in `actions/setup-node`. That writes an `.npmrc` with a placeholder `_authToken` that npm prefers over OIDC exchange, causing authentication failure.

### E2 — Configure the trusted publisher on npmjs.com

Run locally (one-time, requires 2FA and write access):

```bash
npm install -g npm@^11.15.0
cd /home/p31/p31-cli
npm trust github --file=ci.yml --repository=p31labs/p31-cli --allow-publish
```

The `--file` argument is the bare workflow filename, not a path. This opens a browser auth flow; confirm it.

### E3 — Verify the trust configuration

```bash
npm trust list --package=@p31ca/cli
```

### E4 — Remove NPM_TOKEN from GitHub Secrets

After the trust configuration is active, delete the `NPM_TOKEN` secret from the repository settings. The next tag push should publish via OIDC with no token.

### E5 — Test the flow

Create and push a lightweight tag:

```bash
git tag v3.1.4-oidc-test
git push origin v3.1.4-oidc-test
```

Watch the GitHub Actions run. If it publishes and the npm package page shows a Provenance badge, the track is complete. If it fails with `ENEEDAUTH` or `E404`, check the failure-mode table: the most common causes are a reusable workflow (`workflow_call`), npm < 11.15.0, or a `registry-url` placeholder.

### Completion signal
Provenance badge appears on the npm package page for the next published version.

---

## Dependency Map and Execution Order

| Track | Can start now? | Blocked by | Completion signal |
|-------|---------------|------------|-------------------|
| E (OIDC) | Yes | None | Provenance badge on next publish |
| A (Skills) | Yes | None | 5 SKILL.md files in npm pack |
| C (Hash chain) | Yes | None | 10-entry chain verifies; tamper tests pass |
| B (Registry) | Yes, but listing should reference skills | A (skills published) | registry.modelcontextprotocol.io/servers/com.p31ca/governed-agent-cli resolves |
| D (Show HN) | After A + C | A and C complete | Launch thread posted Tuesday 6–8 AM ET |

**Recommended parallel start:** Begin E, A, and C simultaneously. E is a one-hour configuration task. A is a content-writing task that can proceed in parallel with C's schema work. C is the longest engineering task (1 week). B can begin DNS propagation immediately (Steps B1–B3) while A finishes, since the TXT record propagation is independent of the skills content. D should be scheduled for the first Tuesday after A and C are verified — at least 48 hours of buffer to fix any issues the demo surfaces.

### The Runbook in One Line

E removes the token. A makes the CLI agent-discoverable. C makes the guard auditable. B claims the category. D tells the story — and by launch day, every claim is backed by a verifiable artifact.
