# P31 CLI Merge Plan — Single Source of Truth

## Overview

This document describes the merge of `p31-cli` (v3.0.0, TypeScript) and `production/cli` (v1.1.2, JavaScript) into a unified CLI.

## Architecture

```
p31-cli/
├── src/
│   ├── mcp-servers/           # 10 MCP server modules (ported from production/cli)
│   │   ├── index.ts           # Barrel export + unified tool registry
│   │   ├── oasis-server.ts    # CLI session state (11 tools)
│   │   ├── love-registry.ts   # LOVE ledger (4 tools)
│   │   ├── cognitive-prosthetic.ts  # Neurodivergent support (47 tools)
│   │   ├── spaceship-server.ts      # DUNA / dome structure (4 tools)
│   │   ├── ground-truth-server.ts   # Verified facts registry (14 tools)
│   │   ├── marge-server.ts          # Design system compliance (12 tools)
│   │   ├── soulsafe-server.ts       # 3-gate verification (15 tools)
│   │   ├── bob-server.ts            # Building ontology (10 tools)
│   │   ├── component-registry.ts    # Component registry (5 tools)
│   │   └── design-mcp-server.ts     # Design tokens (11 tools)
│   ├── mcp-bridge.ts          # Unified MCP bridge (single entry point)
│   ├── mcp-http.ts            # HTTP MCP server
│   ├── stream-server.ts       # WebSocket stream relay
│   ├── session-store.ts       # SQLite session store
│   ├── commands/              # CLI commands
│   ├── lib/                   # Utilities
│   ├── providers/             # LLM providers
│   ├── plugins/               # OpenCode plugins
│   └── tui/                   # Ink TUI
├── tokens/                    # Design tokens (from production/cli)
├── docs/                      # Documentation
│   ├── merge-plan.md          # This file
│   ├── active-grants.md       # Grant tracking
│   ├── court-document.md      # Court evidence
│   ├── next-moves.md          # Strategic plan
│   └── pilots.yml             # Pilot registry
├── opencode.json              # Unified OpenCode config
├── package.json               # Merged dependencies
└── AGENTS.md                  # Agent instructions
```

## MCP Server Inventory

| Server | Category | Tools | Description |
|--------|----------|-------|-------------|
| oasis | oasis | 11 | CLI session state and slash commands |
| love-registry | love | 4 | LOVE ledger and care attestation |
| cognitive-prosthetic | cognitive | 47 | Neurodivergent cognitive support |
| spaceship | spaceship | 4 | DUNA and dome structure |
| ground-truth | ground-truth | 14 | Verified facts registry |
| marge | marge | 12 | Design system compliance |
| soulsafe | soulsafe | 15 | 3-gate verification protocol |
| bob | bob | 10 | Building ontology and structure |
| component-registry | component | 5 | Component registry |
| design-mcp-server | design | 11 | Design tokens and validation |
| **Total** | | **133** | |

## Migration Guide

### From production/cli

1. **MCP Servers**: All MCP servers are now in `src/mcp-servers/`. The unified bridge (`src/mcp-bridge.ts`) provides a single entry point.

2. **Design Tokens**: Copied to `tokens/`. The design MCP server (`src/mcp-servers/design-mcp-server.ts`) provides access.

3. **Configuration**: Use `opencode.json` instead of `.p31-mcp.json`.

4. **Binary**: Use `p31` instead of `andromeda`.

5. **Node.js**: Requires Node.js >= 22 (upgraded from >= 20).

### From p31-cli

1. **MCP Servers**: The original 26 tools are now part of the unified 133-tool surface.

2. **Plugins**: All 6 OpenCode plugins are preserved.

3. **Providers**: All 3 LLM providers (Anthropic, Google, OpenRouter) are preserved.

4. **UI**: Ink TUI + React Web UI preserved.

## API Usage

### List all tools

```typescript
import { listTools } from './mcp-bridge.js';
const tools = listTools();
console.log(`Total tools: ${tools.length}`);
```

### Call a tool

```typescript
import { callTool } from './mcp-bridge.js';
const result = callTool('oasis_status', {});
```

### Get tools by category

```typescript
import { getToolsByCategory } from './mcp-bridge.js';
const cognitiveTools = getToolsByCategory('cognitive');
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `LOVE_LEDGER_URL` | LOVE ledger endpoint |
| `LEDGER_BRIDGE_URL` | Ledger bridge endpoint |
| `P31_USER_ID` | Default user ID |
| `P31_AGENT_ACTOR` | Agent actor for governance |
| `P31_NO_LEDGER` | Disable governance ledger |

## License

MIT — P31 Labs, Inc.
