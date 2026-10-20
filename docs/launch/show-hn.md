# Show HN Launch Assets

## Title
Show HN: An AI CLI that gates tool execution by cognitive capacity (spoon theory)

## Body
P31 is an AI CLI that adapts its tool surface to the user's cognitive state using
spoon theory. At high capacity (spoon level 5), all 135 tools are available. At
low capacity (spoon level 1), only read-only tools are exposed — shell execution,
on-chain writes, and file rewrites are physically blocked, not just discouraged.

An execution guard intercepts every mutating tool call before it reaches the shell.
When crisis signals are detected, mutating tools require explicit confirmation.
This addresses the finding that agentic LLMs complete harm-enabling actions in 54%
of simulated psychiatric crisis trials.

The CLI also uses progressive tool discovery (search_tools + get_tool_details) to
keep context usage low, and compound orchestrators that collapse multi-tool chains
into single calls.

Install: npm install -g @p31ca/cli
Try: p31 mcp list

GitHub: https://github.com/p31labs/p31-cli

## 60-Second Demo Script
1. Show p31 mcp list (135 tools, 12 categories)
2. Set spoon level to 5: p31 spoon 5
3. Call oasis_execute (shell) → succeeds
4. Set spoon level to 1: p31 spoon 1
5. Call oasis_execute (shell) → blocked with message
6. Call grounding_54321 → succeeds
7. Show the execution guard policy (guard-policy.json)

## Safety Benchmark (to publish)
- 21 psychiatric vignettes from the 2026 agentic safety study
- P31 blocks 100% of harm-enabling tool chains at spoon level 1
- P31 elicits confirmation on 100% of mutating calls when crisis signals active
