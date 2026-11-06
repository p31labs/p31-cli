---
name: assess-capacity
description: Use the P31 assess_capacity compound tool to determine whether the user can work on a task right now, based on spoon level and crisis signals. Activate when the user asks "can I work on this?" or "am I okay to continue?"
allowed-tools: assess_capacity, oasis_status, time_estimate, crisis_check
---

# Assess Capacity

Call `assess_capacity` with the task description and complexity. It returns a `verdict` with `mode` (full / reduced / rest), `estimated_minutes`, and `crisis_flags`, plus a `recommended_block` if work is advisable.

Do not call `oasis_status`, `time_estimate`, and `crisis_check` separately. `assess_capacity` runs all three internally and returns a compact verdict.

If `mode` is `rest`, suggest `grounding_54321` and do not propose work.
