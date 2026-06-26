# Contributing to P31 CLI

We welcome contributions from everyone, especially neurodivergent developers and
families who share our vision of sovereign AI infrastructure.

## Code of Conduct

Be respectful, assume good faith, and support each other. P31 Labs is a
neurodivergent-affirming space. No gatekeeping, no ableism, no harassment.

## Development Setup

```bash
# Prerequisites: Go 1.25.5+, Node.js 18+
git clone https://github.com/p31labs/p31-cli
cd p31-cli
go mod download
go build -o p31 .
```

## Testing

```bash
go test ./... -race
go vet ./...
```

## Project Structure

```
cmd/           # Cobra commands (chat, spoon, mesh, etc.)
internal/      # MCP agent, TUI components, config
  mcp/         # MCP client wrapper + tool routing
  tui/         # Bubble Tea components
  config/      # Config file loading
main.go        # Entry point
```

## Pull Request Process

1. Open an issue first to discuss the change
2. Create a feature branch (`git checkout -b feat/my-change`)
3. Run `go vet ./...` and `go test ./...` before committing
4. Keep PRs focused — one feature or fix per PR
5. Update docs if you change CLI behavior

## MCP Servers

MCP server definitions are in `cmd/chat.go` (`initMCP()`). If you're adding a
new MCP server, add a `ServerDef` entry there.

## License

MIT — see [LICENSE](LICENSE).
