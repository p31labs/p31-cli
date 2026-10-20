# Next Moves — Post-K₄ Collapse (Sept 16, 2026)

**State:** Tetrahedron live. 7 portals + 6 mesh edges + MCP Registry listing all verified 200. Command-center v3 deployed with CONTROL_ENABLED=1, /ops/status live, Phase 1-4 infra complete.
**Mantra:** Complete the transformation → fund the court case → build the user base.

---

## Tracks

### Track 1 — MCP Registry Ecosystem (machine, this week)
Official registry listing is live (`org.p31ca/oasis-mcp` v1.0.0). Claim the discovery and conversion surfaces:
- **Glama** — API key stored as wrangler secret on p31-crypto-mcp + p31-design-mcp; submission script ready (`scripts/submit-mcp-registries.sh`)
- **Smithery** — CLI installed (`npm install -g smithery`); API key stored as wrangler secret; manual `smithery auth login` + `smithery mcp publish` required for registry listing
- **PulseMCP** — ingests from official registry; verify it propagated.
- Agent-readable docs: `cli/llms.txt`, agent/ dir already satisfy Agent-Native spec (98 rules).

### Track 2 — Grant Window (blocks human)
| Grant | Amount | Deadline | Status |
|-------|--------|----------|--------|
| **TRANSFORM** | $1,000 + mentorship | **Sept 18** | PITCH READY — submit NOW |
| **Modest Needs** | Up to $1,000 | Rolling | Ready, submit this week |
| **OSC fiscal host** | 10% fee | Rolling | Ready (`OPEN_SOURCE_COLLECTIVE_APPLICATION.md`) — prerequisite for big grants |
| **Humanity AI** | $75K–$1M (open call) | **Oct 21** 4:59 PM PT | NEW — US 501(c)(3) or fiscal sponsor; open-source AI priority; stream: education / labor-economy / arts-humanities |
| **NSF SBIR Phase I** | $305K no equity | **Nov 4** | NEW — needs project pitch package |
| **Biswas Fast Grants** | $25K–$100K | Dec 15 | NEW — AI-and-health, institutional affiliation |
| **OTF FOSS Sustain** | $150K–$400K | Rolling | 2027 target (needs 3yr release history) |
| **Anthem (UK)** | n/a | Sept 25 | Ages 18–25 (30 if ND/disabled), UK-only |

Critical path: **OSC → Humanity AI → NSF SBIR → court evidence (Oct 15).**

### Track 3 — Show HN (Sept 23, 9:10 AM ET)
- Theory confirms Tue/Wed 8–11 AM ET; only 2.3% of posts hit front page; median score 2; first 2 hours decide.
- Draft at `cli/show-hn-sept23.md` is solid. Two adjustments from research:
  1. Lead with the **problem** (79% multi-agent failures are coordination/spec), keep title clean — currently good.
  2. Founder comment: hand-written, personal story, end with a specific question. Keep 12h reply window.
- Optional: add mesh live status (`curl mesh.p31ca.org/health` → isostatic) as proof-of-liveness in the thread.

### Track 4 — Funding Infrastructure
- **GitHub Sponsors**: payouts via Stripe now; can route through fiscal host (OSC). First payout has 60-day probation — activate profile ASAP regardless of traffic.
- OSC fee 10%; every.org 0% later.

### Track 5 — Narrative / Court Evidence
- Court doc update every 72h (next: ~Sept 19). Fold in: MCP registry propagation, grant submissions, Show HN metrics, waiver/PR evidence.
- Daily monitor log already seeded in `cli/logs/`.

---

## Parallel Execution

### Automation status (Sept 17, 02:10 ET)
- ✅ **Email sweep** — `willyj1587@gmail.com` now operative across 74 files; `willyj1587@gmail.com` annotated OOC (reactivating soon)
- ✅ **Continuous monitor** — `scripts/p31-monitor.sh`, 17 surfaces, cron `0 */6 * * *`; logs `cli/logs/monitor.jsonl`
- ✅ **MCP registry keys stored** — SMITHERY_API_KEY + GLAMA_API_KEY stored as wrangler secrets on p31-crypto-mcp + p31-design-mcp
- ✅ **NSF SBIR pitch** — `docs/grants/NSF-SBIR-2026-PITCH.md`
- ✅ **Show HN comment** — `cli/show-hn-sept23.md`
- ⚠️ **MCP registry submission** — requires interactive `smithery auth login` (OAuth); keys stored, CLI installed, ready to publish

### Human (meatspace) — next 72 hours
1. **TRANSFORM grant** — paste pitch from `active-grants.md` → transformgrant.org/apply (**Sept 18 — tomorrow**)
2. **GLSP call** — 1-833-457-7529
3. **Modest Needs** this week
4. **OSC apply** this week (20 min, copy-paste ready) → unlocks Humanity AI
5. **MCP registries** — run `smithery auth login` once, then `bash scripts/submit-mcp-registries.sh` (keys already stored as secrets)
6. **Start Humanity AI** app (Oct 21 deadline)

### Machine (agent) — continuous
1. Health monitor every 6h (deployed) + deadline alerts
2. Court doc update every 72h (next ~Sept 19)
3. Technical blog post every 48h
4. Poll MCP registry + GitHub stars/issues
5. NSF SBIR full-proposal drafting (after pitch feedback)
6. Grant portal status tracking

---

## Risk
- OAuth token cannot touch DNS (no dns:write) — all DNS needs user dashboard action.
- `SUBSTRATE_ENABLED` stays false until approved.
- Do not flip OTF: P31 lacks 3-year release history → 2027.