# AGENTS.md — P31 Sovereign CLI

**P31 CLI:** a unified sovereign AI agent for neurodivergent families. OpenCode face, P31 guts.

## Quick Start

```bash
# Install
# Or from source
git clone https://github.com/p31labs/p31-cli.git
cd p31-cli
npm install
npm run build

# Run
p31                    # Interactive TUI
p31 chat              # One-shot chat
p31 agent             # Autonomous agent mode
p31 mcp               # MCP stdio server
p31 mcp:http          # MCP HTTP server
p31 tui               # Ink TUI
p31 phos              # PHOS forge commands
p31 spoons            # Spoon level management
p31 session           # Session management
p31 sync              # Cross-app sync
```

## Architecture

- **TypeScript** (ESM, Node.js >= 22)
- **MCP Protocol** — 133 tools across 10 categories
- **OpenCode Plugins** — 6 sovereign plugins
- **3 LLM Providers** — Anthropic, Google Gemini, OpenRouter
- **SQLite Sessions** — Per-session-tree sharding
- **Ink TUI** — 3 themes, spoon-aware adaptive UI
- **React Web UI** — xterm.js terminal viewer

## Agent Capability Manifests

**Core principle:** Agents declare *what* they need (capability bucket, latency ceiling, context window, structured-output requirement). They never name a model. The capability router resolves to a concrete model from the pool. This is the technical translation of "never lock an agent to a certain role."

**Location:** `/home/p31/p31-cli/agents/`

**Manifest schema:** `agents/manifest-schema.json` (referenced in `src/types.ts`)

**Available manifests:**

- `agents/build.json` – bucket `fast-code`
- `agents/plan.json` – bucket `deep-reasoning`
- `agents/scout.json` – bucket `fast-code`

**Template:**

```json
{
  "agentId": "build",
  "capabilities": ["tool-calling", "structured-json", "code-generation"],
  "bucket": "fast-code",
  "constraints": {
    "maxLatencyMs": 2000,
    "requireToolCalling": true,
    "minContextWindow": 128000,
    Pele: "free"
  },
  "toolPermissions": ["read", "write", "shell"],
  "mcpAllowlist": ["bob", "design-parity", "ground-truth"]
}
```

**Behavior under model churn:**

Two agents with identical `bucket` declarations (e.g., `build` and `scout`, both `bucket: "fast-code" and matching capabilities/constraints) resolve to the same routing decision. Changing the concrete model in the pool (e.g., swapping `deepseek-v4-flash` for `claude-opus-4`) does **not** require any change to the agent definition. Their instruction hash (via `loadInstructionSet`) remains the same, so they behave identically.

**Notes:**

- Manifests are **not** static agent roles. They are capabilities declarations that can be dynamically re-evaluated.
- The `bucket` field is the key routing abstraction used by Lane L1's capability router (see `src/routing/` in L1).
- No manifest references a model name – models are selected exclusively by the bucket router at runtime.

## MCP Servers

| Category | Tools | Description |
|----------|-------|-------------|
| oasis | 11 | CLI session state |
| love | 4 | LOVE ledger |
| cognitive | 47 | Neurodivergent support |
| spaceship | 4 | DUNA / dome |
| ground-truth | 14 | Verified facts |
| marge | 12 | Design compliance |
| soulsafe | 15 | 3-gate verification |
| bob | 10 | Building ontology |
| component | 5 | Component registry |
| design | 11 | Design tokens |

## Configuration

- `opencode.json` — OpenCode configuration
- `~/.config/opencode/opencode.json` — Global OpenCode config
- `~/.p31/cli-session.json` — CLI session state

## Design System

- **Tokens:** `tokens/tokens.yml`
- **Components:** `tokens/components.yml`
- **Themes:** p31ca, phosphorus31, crisis
- **Accessibility:** Atkinson Hyperlegible, 48px touch targets, WCAG AAA

## Environment Variables

| Variable | Description |
|----------|-------------|
| `LOVE_LEDGER_URL` | LOVE ledger endpoint |
| `LEDGER_BRIDGE_URL` | Ledger bridge endpoint |
| `P31_USER_ID` | Default user ID |
| `OPENCODE_CONFIG` | Custom OpenCode config path |

## License

MIT — P31 Labs, Inc.