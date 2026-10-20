# AGENTS.md — P31 Sovereign CLI

**P31 CLI:** a unified sovereign AI agent for neurodivergent families. OpenCode face, P31 guts.

## Quick Start

```bash
# Install
curl -fsSL https://cli.p31ca.org/install | bash

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
