# MCP Registry Listing — P31 Governed Agent CLI

## Server Name
`com.p31ca/governed-agent-cli`

## Category
Safety & Governance

## Short Description
A governed AI agent CLI that gates tool execution by cognitive capacity (spoon theory) and enforces runtime safety policies at the protocol boundary.

## Full Description
P31 is the first AI CLI that adapts its tool surface to the user's cognitive state. Using spoon theory as a structural constraint (not a UI preference), P31 progressively unlocks tools based on available capacity — from crisis-only (2 tools) to full surface (135 tools). An execution guard intercepts every mutating tool call before it reaches the shell, blocking or escalating based on spoon level and crisis signals.

Unlike general-purpose coding CLIs that compete on benchmark scores, P31 competes on governance that is structural, not advisory. The execution guard, spoon-level gating, and tool fingerprinting are all runtime-enforced, not prompt-level suggestions.

## Key Differentiators
1. **Spoon-level tool surface gating** — tools are physically unavailable at low capacity, not just discouraged
2. **Execution guard** — mutating tool calls intercepted before execution (blocks shell at spoon≤1, elicits on crisis signals)
3. **Tool fingerprinting** — SHA-256 manifest detects tool description drift (OWASP MCP03 defense)
4. **135 hardened tools** — full schema audit (descriptions, titles, annotations, inputSchema properties)
5. **Progressive discovery** — search_tools + get_tool_details reduce context bloat per MCP spec best practices
6. **Compound orchestrators** — programmatic tool calling collapses multi-tool chains into single calls

## Links
- GitHub: https://github.com/p31labs/p31-cli
- npm: https://www.npmjs.com/package/@p31ca/cli
- Docs: https://p31ca.org/docs
- Safety Policy Schema: https://p31ca.org/schemas/guard-policy.v1.json

## Tags
safety, governance, cognitive-accessibility, neurodivergent, spoon-theory, execution-guard, mcp, cli, capacity-adaptive
