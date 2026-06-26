# Changelog

## [1.0.0] — 2026-06-25

### Added
- Initial public release
- `p31 chat` — interactive TUI with command palette and MCP tool integration
- `p31 spoon` — cognitive load level display
- `p31 mesh status` — K4 family mesh view
- 28+ subcommands for infrastructure, identity, and integration
- MCP agent connecting to PHOS Forge (26 tools) and Google Workspace
- Context timeouts (60s AI, 30s tool calls) — no more hangs
- Clean shutdown with MCP process cleanup
- Config file at `~/.p31/config.yaml`
- Router proxy integration on `:4001`

### Infrastructure
- Cross-platform binaries: linux/amd64, linux/arm64, darwin/amd64, darwin/arm64
- Cloudflare Pages site at cli.p31ca.org
- One-line installer: `curl -fsSL https://cli.p31ca.org/install | bash`
- Full documentation at cli.p31ca.org/docs
