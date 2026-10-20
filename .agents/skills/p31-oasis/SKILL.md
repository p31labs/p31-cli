# P31 Oasis — CLI Agent Skill

Router for P31 Oasis CLI commands. Use this skill when the agent needs to interact with the P31 sovereign-assistive stack.

## Triggers

- User asks about P31, Oasis, sovereign CLI, or mesh status
- Agent needs to enforce contracts, provenance, or cost governance
- Agent needs to interact with Node Zero, LOVE Ledger, or PHOS Forge
- User runs `p31` or `andromeda` commands

## Surfaces

| Surface | Command | Audience | Purpose |
|---------|---------|----------|---------|
| Sovereign Chat | `p31 chat` | Families, end users | Spoon-aware AI, K₄ mesh, daily use |
| Oasis TUI | `andromeda` | Developers, operators | Governance, provenance, cost, MCP |

## Discovery

Before invoking any command, run:
- `p31 schema` (or `andromeda --schema`) to discover available command shapes
- `p31 mcp list` (or `andromeda mcp list`) to list MCP servers
- `p31 help <command>` for command-specific help

## Guardrails

- All mutating commands support `--dry-run`
- All commands emit structured JSON when `--agent` is set or `OUTPUT_FORMAT=json`
- Provenance chain is attached to every command: `principal`, `session_id`, `command`, `dry_run`
- Never expose secrets or API keys in output

## Cross-References

- Docs: https://p31ca.org/cli
- MCP registry: https://registry.modelcontextprotocol.io
- Ecosystem: https://phosphorus31.org/technology
