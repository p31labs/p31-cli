---
name: soulsafe
description: Use the P31 SOULSAFE 3-gate verification protocol for institutional-grade change verification. Activate when the user asks for a formal audit, compliance evidence, or a deploy-blocking verdict.
allowed-tools: soulsafe_run_protocol, soulsafe_tagout, soulsafe_severity
---

# SOULSAFE 3-Gate Protocol

Run `soulsafe_run_protocol` with the change description. It evaluates the change through Gate 1 (self-review), Gate 2 (cross-review with information barrier), and Gate 3 (architect verification), and returns a `verdict` of `CLEARED` or `DEPLOY BLOCKED`.

Critical findings block deployment. High findings block deployment until fixed.
