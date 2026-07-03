# P31 Sovereign CLI

Sovereign AI agent for neurodivergent families.

## Installation

```bash
curl -fsSL https://cli.p31ca.org/install | bash
```

Or install from source:

```bash
git clone https://github.com/p31labs/p31-cli
cd p31-cli
npm install && npm run build && npm link
```

## Quick Start

### Interactive Chat

```bash
p31 chat --model deepseek-v4-flash
```

### Autonomous Agent

```bash
p31 agent "Fix the evidence vault endpoint"
```

### Stream Terminal

```bash
p31 stream --title "Building K4 Mesh" --command "bash"
```

### Web Interface

```bash
p31 ui
```

### MCP Tools

```bash
p31 mcp --list
p31 mcp --call evidence_verify --args '{"evidenceId":"ev-123"}'
```

### Spoon Controls

```bash
p31 spoons        # Show current level
p31 spoons 1      # Low energy mode
p31 spoons 5      # Full energy mode
```

## Commands

| Command | Description |
|---------|-------------|
| `chat` | Interactive chat session |
| `agent` | Run autonomous agent |
| `stream` | Stream terminal via WebSocket |
| `ui` | Open web interface |
| `mcp` | MCP tool management |
| `spoons` | Set cognitive load level |
| `init` | Initialize config |

## Architecture

- **TypeScript + Node.js** — Type-safe, production-ready
- **MCP Protocol** — 26 tools across 7 categories
- **WebSocket Streaming** — Live terminal relay via PTY
- **Spoon-Aware UI** — Adapts to cognitive load (levels 1/3/5)
- **Web Viewer** — React + xterm.js browser interface

## License

MIT — P31 Labs, Inc.
