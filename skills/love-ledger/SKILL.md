---
name: love-ledger
description: Read and write LOVE ledger entries via the P31 MCP tools. Activate when the user asks about LOVE balance, care attestation, or on-chain anchoring.
allowed-tools: love_status, love_balance, love_sync, love_anchor
---

# LOVE Ledger

Read operations: `love_status`, `love_balance`, `love_sync`. These are safe at any spoon level.

Write operation: `love_anchor` anchors a ledger entry hash on Base Sepolia. It is guarded: at spoon level ≤ 2 it requires elicitation, and it is blocked if crisis signals are active.

Always read `love_status` before proposing an anchor, and explain the transaction hash and explorer link after a successful anchor.
