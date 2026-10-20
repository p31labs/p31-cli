---
name: safe-execution
description: Understand when the P31 execution guard allows, blocks, or escalates mutating tool calls. Activate before calling oasis_execute, love_anchor, truth_register_fact, or design_expert_ephemeralize.
allowed-tools: oasis_execute, love_anchor, truth_register_fact, design_expert_ephemeralize
---

# Safe Execution

The execution guard runs before every mutating tool call. It evaluates spoon level and recent crisis signals against `guard-policy.json`.

- **Blocked**: shell execution (`oasis_execute`) at spoon level ≤ 1. The guard returns `{ status: "blocked" }` and suggests a read-only alternative.
- **Elicitation required**: mutating tools when crisis signals are active. The client must confirm with the user before resubmission.
- **Allowed**: all other cases.

Never bypass the guard by calling a different tool to achieve the same effect.
