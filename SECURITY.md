# Security Policy — @p31ca/cli

## Market Context: The Governance Gap

The MCP ecosystem has a documented security crisis:

- **91.8% of 414 audited production MCP servers lacked OAuth authentication** (July 2026, Pomerium assessment)
- **84.2% tool-poisoning attack success rate** against MCP-connected agents with auto-approval enabled (Invariant Labs, 2026)
- **42,753 servers** in the MCP Registry as of October 2026, but **zero governance-category servers approved** (issue #978 still open)
- The A2A Registry specification stalled in August 2026; development redirected to the Agent Registry Definition (ARD)

P31's execution guard and hash-chained audit trail are runtime countermeasures to these documented failure modes. Tool/skill description fingerprinting exists only as unwired primitives (see §1–2); tool-description governance in 3.1.3 is record-and-flag (heuristic), not enforcement.

## What Provenance Does (and Does Not) Prove

npm provenance (via OIDC Trusted Publishing) provides a cryptographically
signed attestation linking the published tarball to the exact GitHub Actions
workflow run and commit that built it. It proves chain-of-custody.

It does NOT prove:
- The source code is trustworthy
- The maintainer is trustworthy
- The build script is free of malicious steps
- The tool descriptions have not been tampered with

## Complementary Trust Artifacts

### 1. Tool Description Fingerprinting (OWASP MCP03 — primitives only, not enforced in 3.1.3)

OWASP MCP Top 10 entered Phase 3 (Beta) in 2026. MCP03 Tool Poisoning is the dedicated entry for inference-time poisoning originating from tool definitions. The recommended defenses — schema quarantine, SHA-256 tool pinning at first approval, and rejection of any hash change — are **not implemented as an enforced control in P31 3.1.3**. P31 ships fingerprinting *primitives* only:

- `computeFingerprint()` / `verifyFingerprints()` (`src/safety/tool-fingerprint.ts`) hash a tool's canonical `{name, description, inputSchema}` with SHA-256 and return `{ valid, drifted[] }`. **Nothing calls them automatically: they are not wired into startup or tool registration, no fingerprint manifest is generated at build time, and no manifest is committed to the repository. No tool is refused on description drift.**
- Separately, the L7 runtime path records `descriptionHash` (SHA-256 of the tool description) and a heuristic `descriptionPoisoningRisk` flag (`none`/`suspicious`/`high`) on audit records via `markRetrievedSources()`. This is a **signal for audit, not an enforcement gate**: P31 does **not** reject a session or tool on hash change, and a `suspicious` or `high` flag does not change the guard verdict. Enforcement remains at the execution-guard elicitation boundary (§3).

The 84.2% attack success rate (Invariant Labs, 2026) applies specifically to MCP-connected agents with auto-approval enabled. P31 eliminates auto-approval entirely: every mutating tool call passes through the execution guard before execution.

- Implementation (primitives, unwired): `src/safety/tool-fingerprint.ts`
- Runtime description governance (record-only): `src/mcp-servers/index.ts` `buildToolAttribution()`, `src/safety/guard-audit.ts` `markRetrievedSources()`
- Verification: `verifyFingerprints()` returns `{ valid, drifted[] }` when called manually; **no automatic check runs in 3.1.3**

### 2. Skill Instruction Fingerprinting
SKILL.md files shipped in the `skills/` directory can be fingerprinted with `computeSkillFingerprint()` / `generateSkillFingerprints()`. **These helpers are not wired into skill loading; no poisoned-skill detection currently runs before an agent loads a skill.**

- Implementation (primitives, unwired): `computeSkillFingerprint()` in `src/safety/tool-fingerprint.ts`

### 3. Execution Guard (Runtime Safety)
Mutating tool calls are intercepted before execution. The guard evaluates
spoon level and crisis signals against `guard-policy.json` and returns
`blocked`, `elicitation_required`, or `allowed`.

- Implementation: `src/safety/execution-guard.ts`
- Policy: `src/safety/guard-policy.json`
- Tests: `tests/unit/execution-guard.test.ts` (10 adversarial tests)

### 4. Signed Guard Decision Records (Tamper-Evident Audit)
Every guard decision is emitted as a JSON record with:
- SHA-256 hash chain (genesis = `SHA-256("chainproof:genesis")`)
- Ed25519 signature over the data hash
- Version-bound to the active guard-policy.json version
- Append-only JSONL log at `~/.p31/guard-audit.jsonl`

- Implementation: `src/safety/guard-audit.ts`
- Tests: `tests/unit/guard-audit.test.ts` (8 tests including tamper detection)

### 5. Spoon-Level Tool Surface Gating
Tools are physically unavailable at low cognitive capacity levels:
- Level 0: 2 tools (crisis only)
- Level 1-2: 14 tools (read-only)
- Level 3-4: 16 tools (compound + discovery)
- Level 5: 135 tools (full surface)

- Implementation: `src/safety/spoon-gating.ts`
- Benchmark: 89% token reduction at spoon level 1 vs full surface

### 6. mcp-scan Results
The published MCP bridge was scanned with `mcp-scan` v2.1.0 (Invariant Labs, acquired by Snyk 2026).
Result: **0 issues** — all clear.

Raw scan output:
```
✓ mcp-config › p31-unified  0 issues
All clear (1 server scanned in 16ms)
```

Tool-poisoning attack success rates in the wild (2026): ~84.2% (Invariant Labs, Cisco mcp-scanner).
P31's execution-guard boundary and the reported mcp-scan clean result are relevant signals; P31 does not claim an enforced tool-description-integrity control in 3.1.3.

### 7. Evidence Artifacts
| Artifact | Location | Verification |
|----------|----------|-------------|
| Tool fingerprint manifest | **Not generated/committed in 3.1.3** | `verifyFingerprints()` → `{ valid, drifted[] }` (manual call only) |
| Skill fingerprints | `src/safety/tool-fingerprint.ts` (unwired) | `computeSkillFingerprint()` per SKILL.md (manual only) |
| Guard audit chain | `~/.p31/guard-audit.jsonl` | `verifyGuardChain()` — Ed25519 + SHA-256 |
| mcp-scan results | This document | `npx mcp-scan scan --config mcp-config.json` |
| Guard policy schema | `src/safety/guard-policy.json` | JSON Schema validation |
| Spoon-gating benchmark | `docs/` | 89% token reduction at spoon 1 vs 5 |

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it to:
- GitHub Issues: https://github.com/p31labs/p31-cli/issues
- Email: security@p31ca.org

## Supported Versions

| Version | Supported |
|---------|-----------|
| 3.1.x   | Yes |
| 3.0.x   | Yes |
| < 3.0   | No |
