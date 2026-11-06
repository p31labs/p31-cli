---
name: progressive-discovery
description: Find the right P31 tool without loading all 135 tool definitions into context. Activate when you are unsure which P31 tool to call.
allowed-tools: search_tools, get_tool_details
---

# Progressive Discovery

Call `search_tools` with a natural-language query and optional category filter. It returns tool names and one-line descriptions only.

Then call `get_tool_details` with the exact tool name to fetch the full `inputSchema` and `outputSchema`.

Only after inspecting the schema should you call the tool itself.

Categories available: oasis, love, cognitive, spaceship, ground-truth, marge, soulsafe, bob, component, design, discovery, compound.
