# Show HN Launch — P31

## Title (max 80 chars)
Show HN: An AI CLI that gates tool execution by cognitive capacity (spoon theory)

## Timing
Tuesday 6:00–8:00 AM ET (before front page fills)

## Founder Comment

I built this because I have a shell-commanding AI agent that doesn't know when I'm out of spoons. At spoon level 1, `rm -rf` and `git push --force` are still one prompt away. So I built an execution guard that blocks mutating tool calls below a configurable cognitive threshold — and emits a signed, hash-chained audit record for every decision.

The CLI ships 135 MCP tools across 12 categories. At spoon level 0 (crisis), only 2 tools are available. At level 1-2, 14 read-only tools. At level 3-4, 16. At level 5, all 135. That's an 89% token reduction at low capacity — the agent physically cannot see the tools it shouldn't call.

Every guard decision is Ed25519-signed and SHA-256 hash-chained (genesis aligned to chainproof standard). Tool descriptions are SHA-256 hashed into the audit record with a heuristic poisoning-risk flag — a recorded signal for review, not an enforcement gate; reject-on-change is not implemented. The published MCP bridge passed mcp-scan clean (0 issues).

Try it: `npm install -g @p31ca/cli && p31 mcp list`

## Links
- npm: https://www.npmjs.com/package/@p31ca/cli
- GitHub: https://github.com/p31labs/p31-cli
- SECURITY.md: https://github.com/p31labs/p31-cli/blob/main/SECURITY.md
- Guard policy: https://github.com/p31labs/p31-cli/blob/main/src/safety/guard-policy.json

## Pre-launch Checklist
- [ ] Spoon-gating demo recorded (60s)
- [ ] README top section verified (one-line install)
- [ ] mcp-scan results linked
- [ ] Guard policy schema linked
