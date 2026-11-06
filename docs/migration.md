# Migration Guide — production/cli → p31-cli

## Overview

This guide helps migrate from `production/cli` (andromeda-cli v1.1.2) to `p31-cli` (v3.0.0).

## Key Changes

| Aspect | Before | After |
|--------|--------|-------|
| Package name | `andromeda-cli` | `@p31/cli` |
| Binary | `andromeda` | `p31` |
| Language | JavaScript | TypeScript |
| Node.js | >= 20 | >= 22 |
| MCP tools | 10+ scattered files | 133 unified tools |
| Plugins | 0 | 6 OpenCode plugins |
| Providers | 1 (Anthropic) | 3 (Anthropic, Google, OpenRouter) |
| UI | blessed TUI | Ink TUI + React Web |
| Tests | Jest (minimal) | Vitest (comprehensive) |

## MCP Server Migration

### Before (production/cli)

```javascript
// Each server was a separate file
node cli/mcp-server.js        # 11 tools
node cli/love-registry.js     # 4 tools
node cli/cognitive-prosthetic.js  # 47 tools
// ... etc
```

### After (p31-cli)

```typescript
// Unified bridge — single entry point
import { callTool } from './mcp-bridge.js';

// Call any tool by name
callTool('oasis_status', {});
callTool('love_balance', { userId: 'did:key:...' });
callTool('time_estimate', { task: 'Fix bug', complexity: 'medium', spoons: 3 });
```

## Configuration Migration

### Before (.p31-mcp.json)

```json
{
  "mcpServers": {
    "dads": {
      "url": "https://dads.trimtab-signal.workers.dev/mcp"
    }
  }
}
```

### After (opencode.json)

```json
{
  "mcp": {
    "dads": {
      "type": "remote",
      "url": "https://dads.trimtab-signal.workers.dev/mcp"
    }
  }
}
```

## Design Tokens

Design tokens are now in `tokens/tokens.yml` and accessible via the design MCP server:

```typescript
callTool('token_resolve', { path: 'p31.color.accent.default' });
callTool('component_schema', { name: 'GlassCard' });
```

## Session State

### Before

```bash
# Session stored in ~/.p31/cli-session.json
```

### After

```bash
# Session stored in SQLite with per-session-tree sharding
p31 session list
p31 session delete <id>
```

## Environment Variables

| Before | After | Description |
|--------|-------|-------------|
| `LOVE_LEDGER_URL` | `LOVE_LEDGER_URL` | Same |
| `LEDGER_BRIDGE_URL` | `LEDGER_BRIDGE_URL` | Same |
| — | `P31_USER_ID` | Default user ID |
| — | `OPENCODE_CONFIG` | Custom config path |

## Support

- Docs: https://p31ca.org/docs
- GitHub: https://github.com/p31labs/p31-cli
- Discord: https://discord.gg/p31
