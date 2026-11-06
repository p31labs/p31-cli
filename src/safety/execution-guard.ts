/**
 * Execution Guard — Tool-call interception layer
 *
 * Moves SOULSAFE from conversation to execution. Runs before any mutating
 * or external-facing tool executes, per the 2026 research on agentic
 * mental-health safety (54.3% harm-enabling action rate under execution).
 *
 * Every decision is emitted as a signed, hash-chained audit record
 * (see guard-audit.ts) for compliance and non-repudiation.
 *
 * L7-H: callers may pass `{ audit: false }` to suppress the pre-execution
 * emission, then emit exactly one enriched record (with session id and MCP
 * retrieved-source attribution) after the tool returns. The default remains
 * `audit: true` so every existing call site keeps its behaviour.
 */

import { emitGuardDecision } from './guard-audit.js';
import { getPermissionStore } from './permission-store.js';

export const GUARD_POLICY_VERSION = '2026.10.1';

export type GuardVerdict = 'allowed' | 'blocked' | 'elicitation_required';

/**
 * Has the human already saved an "allow always" rule for this tool? Written by
 * the permission-sync OpenCode plugin (permission.replied → always). A saved
 * allow is an explicit human authorization: the guard skips elicitation but
 * still records the decision.
 *
 * Consults the PermissionStore interface (file-backed by default; swappable
 * for multi-agent or remote deployments).
 */
function hasSavedAllow(projectId: string, toolName: string): boolean {
  try {
    const store = getPermissionStore();
    const rule = store.get(projectId, toolName);
    return rule !== undefined && rule.effect === 'allow';
  } catch {
    return false;
  }
}

const MUTATING_TOOL_PATTERNS = [
  /^oasis_execute$/,        // shell execution
  /^love_anchor$/,          // on-chain write
  /^truth_register_fact$/,  // registry write
  /^design_expert_ephemeralize$/, // file rewrite
];

interface GuardContext {
  spoonLevel: number;
  recentCrisisFlags: number;
  userMessage: string;
  toolName: string;
  toolArgs: any;
  projectId?: string;
}

export interface GuardResult {
  allow: boolean;
  reason?: string;
  requireElicitation?: boolean;
  /** Verdict that was (or should be) recorded — lets deferred callers emit it. */
  verdict: GuardVerdict;
  policyVersion: string;
  governedState: { spoons: number; crisis_flags: number };
}

export function executionGuard(
  ctx: GuardContext,
  opts?: { audit?: boolean },
): GuardResult {
  const governedState = { spoons: ctx.spoonLevel, crisis_flags: ctx.recentCrisisFlags };
  const audit = opts?.audit !== false;

  const result = (verdict: GuardVerdict, reason?: string): GuardResult => {
    if (audit) emitGuardDecision(ctx.toolName, GUARD_POLICY_VERSION, governedState, verdict, reason);
    return {
      allow: verdict !== 'blocked',
      requireElicitation: verdict === 'elicitation_required' ? true : undefined,
      reason,
      verdict,
      policyVersion: GUARD_POLICY_VERSION,
      governedState,
    };
  };

  // 1. Never execute shell commands at spoons <= 1
  if (ctx.toolName === 'oasis_execute' && ctx.spoonLevel <= 1) {
    const reason = 'Shell execution blocked at spoon level 1. Use a read-only tool or rest.';
    return result('blocked', reason);
  }

  // 2. Escalate mutating tools to elicitation when crisis signals are active
  if (MUTATING_TOOL_PATTERNS.some(p => p.test(ctx.toolName)) && ctx.recentCrisisFlags > 0) {
    // A saved "allow always" rule is an explicit human authorization — do not
    // re-elicit. Still record the decision (non-repudiation).
    if (hasSavedAllow(ctx.projectId ?? 'default', ctx.toolName)) {
      return result('allowed', 'saved allow (permission-sync)');
    }
    const reason = 'Crisis signals detected. Confirm you want to proceed with this action.';
    return result('elicitation_required', reason);
  }

  // 3. Block on-chain writes at spoons <= 2 unless explicitly confirmed
  if (ctx.toolName === 'love_anchor' && ctx.spoonLevel <= 2) {
    if (hasSavedAllow(ctx.projectId ?? 'default', ctx.toolName)) {
      return result('allowed', 'saved allow (permission-sync)');
    }
    const reason = 'Low spoon level. Confirm on-chain write.';
    return result('elicitation_required', reason);
  }

  return result('allowed', undefined);
}
