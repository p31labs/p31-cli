# Security Policy — @p31ca/cli

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

### 1. Tool Description Fingerprinting (OWASP MCP03 Defense)
Every tool's canonical `{name, description, inputSchema}` is hashed with SHA-256.
The manifest is committed to the repository and verified at startup. Any drift
in a tool description is detected before the agent acts on it.

- Implementation: `src/safety/tool-fingerprint.ts`
- Manifest: Generated at build time, included in `dist/`
- Verification: `verifyFingerprints()` returns `{ valid, drifted[] }`

### 2. Skill Instruction Fingerprinting
SKILL.md files shipped in the `skills/` directory are also fingerprinted.
A poisoned skill instruction is detected before the agent loads it.

- Implementation: `computeSkillFingerprint()` in `src/safety/tool-fingerprint.ts`

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
P31's fingerprint manifest + mcp-scan clean result places it above the baseline.

### 7. Evidence Artifacts
| Artifact | Location | Verification |
|----------|----------|-------------|
| Tool fingerprint manifest | `dist/` (generated at build) | `verifyFingerprints()` → `{ valid, drifted[] }` |
| Skill fingerprints | `src/safety/tool-fingerprint.ts` | `computeSkillFingerprint()` per SKILL.md |
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
