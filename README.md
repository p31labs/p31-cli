# P31 CLI — Sovereign AI for Neurodivergent Families

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.25.5-00ADD8?logo=go)](https://go.dev)
[![MCP](https://img.shields.io/badge/MCP-%E2%9C%93-2dd4bf)](https://modelcontextprotocol.io)
[![GitHub release](https://img.shields.io/github/v/release/p31labs/p31-cli)](https://github.com/p31labs/p31-cli/releases)
[![CI](https://github.com/p31labs/p31-cli/actions/workflows/ci.yaml/badge.svg)](https://github.com/p31labs/p31-cli/actions/workflows/ci.yaml)
[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub-30363D?logo=github)](https://github.com/sponsors/p31labs)

**p31 chat** is a local-first, post-quantum, spoon-aware AI terminal interface.
It routes through your own proxy, connects to MCP servers (PHOS Forge, Google Workspace),
and adapts to your cognitive load.

---

## Features

- **Spoon-aware AI** — adapts interface and token usage based on your current spoon level
- **K₄ family mesh** — complete graph topology for family connection
- **Post-quantum identity** — ML-DSA-65 signatures, Ed25519 passports, SHA-512 telemetry
- **MCP native** — 26+ tools from PHOS Forge, Google Workspace integration
- **Offline-first** — no cloud dependency; runs via your own router proxy
- **Beautiful TUI** — Bubble Tea, command palette (Ctrl+P), fuzzy search, status bar

---

## Quick Install

```bash
curl -fsSL https://p31-cli.pages.dev/install | bash
```

Or via npm:

```bash
npm install -g @p31/cli
```

---

## Usage

```bash
p31 chat           # Start the interactive TUI
p31 spoon          # Show current spoon level
p31 mesh status    # View K₄ family mesh
p31 doctor         # Run system diagnostics
p31 help           # List all commands
```

---

## Dependencies

- Go 1.25.5+
- Node.js 18+ (for MCP servers)
- A running p31-router proxy on port 4001

---

## MCP Servers

| Server | Tools |
|--------|-------|
| **PHOS Forge** | 26 tools: file adoption, deploy, logbook, brain-dump, jitterbug, cognitive-state, self-healer, etc. |
| **Google Workspace** | Calendar, Gmail, Drive, Docs, Sheets, Contacts |

---

## Configuration

Edit `~/.p31/config.yaml`:

```yaml
proxy_url: http://localhost:4001/v1
proxy_model: flash
```

---

## Development

```bash
git clone https://github.com/p31labs/p31-cli
cd p31-cli
go mod download
go build -o p31 .
./p31 help
```

---

## License

MIT — see [LICENSE](LICENSE).

---

## Links

- [Website](https://cli.p31ca.org)
- [GitHub](https://github.com/p31labs/p31-cli)
- [Documentation](https://cli.p31ca.org/docs)
- [Spatial Oasis](https://cli.p31ca.org/docs/spatial-oasis)
