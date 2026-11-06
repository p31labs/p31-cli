/**
 * L7-I live session trace emission (Wave 3).
 *
 * Emits two real guard decisions through the production emitGuardDecision path
 * with a controlled sessionId + provenance options, into an isolated audit log,
 * so the L7 session trace / chain can be exercised end-to-end (not fixture-only).
 *
 * Env:
 *   P31_SESSION_ID  - session correlation id (default: trace-live-<ts>)
 *   GUARD_AUDIT_DIR - audit dir (default ~/.p31)
 *   GUARD_AUDIT_FILE - audit jsonl (default <dir>/guard-audit.jsonl)
 */
import { emitGuardDecision } from '../src/safety/guard-audit.js';

const sessionId =
  process.env.P31_SESSION_ID || `trace-live-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;

const decisions: Array<{
  tool: string;
  verdict: 'allowed' | 'blocked' | 'elicitation_required';
  reason?: string;
  options?: any;
}> = [
  {
    tool: 'read',
    verdict: 'allowed',
    reason: 'ground-truth source read within policy (live trace emission)',
    options: {
      modelBucket: 'fast-code',
      candidatesConsidered: ['local-sovereign'],
      selectedModel: 'qwen3:4b',
      selectedProvider: 'ollama',
      selectionReason: 'live-trace-test',
      fallbackDepth: 0,
      latencyMs: 42,
      instructionSource: 'live-trace',
      instructionHash: 'live-trace-hash',
      retrievedSources: [
        { sourceId: 'mcp:ground-truth', contentHash: 'h1', freshness: 'FRESH', validity: 'VALID', retrievedAt: new Date().toISOString() },
      ],
    },
  },
  {
    tool: 'shell',
    verdict: 'allowed',
    reason: 'shell command within policy (live trace emission)',
    options: {
      modelBucket: 'fast-code',
      candidatesConsidered: [],
      fallbackDepth: 0,
      latencyMs: 7,
      instructionSource: 'live-trace',
      instructionHash: 'live-trace-hash',
    },
  },
];

for (const d of decisions) {
  const rec = emitGuardDecision(
    d.tool,
    'policy:default-v1',
    { spoons: 0, crisis_flags: 0 },
    d.verdict,
    d.reason,
    { ...(d.options || {}), sessionId },
  );
  console.log(`emitted seq=${rec.seq} tool=${rec.tool} version=${rec.version} sessionId=${rec.sessionId ?? '(none)'}`);
}

console.log(`LIVE_SESSION_ID=${sessionId}`);
