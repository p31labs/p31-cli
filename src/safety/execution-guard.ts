/**
 * Execution Guard — Tool-call interception layer
 *
 * Moves SOULSAFE from conversation to execution. Runs before any mutating
 * or external-facing tool executes, per the 2026 research on agentic
 * mental-health safety (54.3% harm-enabling action rate under execution).
 *
 * Every decision is emitted as a signed, hash-chained audit record
 * (see guard-audit.ts) for compliance and non-repudiation.
 */

import { emitGuardDecision } from './guard-audit.js';
import { getPermissionStore } from './permission-store.js';

const POLICY_VERSION = '2026.10.1';
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

export function executionGuard(ctx: GuardContext): { allow: boolean; reason?: string; requireElicitation?: boolean } {
  const governedState = { spoons: ctx.spoonLevel, crisis_flags: ctx.recentCrisisFlags };

  // 1. Never execute shell commands at spoons <= 1
  if (ctx.toolName === 'oasis_execute' && ctx.spoonLevel <= 1) {
    const reason = 'Shell execution blocked at spoon level 1. Use a read-only tool or rest.';
    emitGuardDecision(ctx.toolName, POLICY_VERSION, governedState, 'blocked', reason);
    return { allow: false, reason };
  }

  // 2. Escalate mutating tools to elicitation when crisis signals are active
  if (MUTATING_TOOL_PATTERNS.some(p => p.test(ctx.toolName)) && ctx.recentCrisisFlags > 0) {
    // A saved "allow always" rule is an explicit human authorization — do not
    // re-elicit. Still record the decision (non-repudiation).
    if (hasSavedAllow(ctx.projectId ?? 'default', ctx.toolName)) {
      emitGuardDecision(ctx.toolName, POLICY_VERSION, governedState, 'allowed', 'saved allow (permission-sync)');
      return { allow: true };
    }
    const reason = 'Crisis signals detected. Confirm you want to proceed with this action.';
    emitGuardDecision(ctx.toolName, POLICY_VERSION, governedState, 'elicitation_required', reason);
    return { allow: true, requireElicitation: true, reason };
  }

  // 3. Block on-chain writes at spoons <= 2 unless explicitly confirmed
  if (ctx.toolName === 'love_anchor' && ctx.spoonLevel <= 2) {
    if (hasSavedAllow(ctx.projectId ?? 'default', ctx.toolName)) {
      emitGuardDecision(ctx.toolName, POLICY_VERSION, governedState, 'allowed', 'saved allow (permission-sync)');
      return { allow: true };
    }
    const reason = 'Low spoon level. Confirm on-chain write.';
    emitGuardDecision(ctx.toolName, POLICY_VERSION, governedState, 'elicitation_required', reason);
    return { allow: true, requireElicitation: true, reason };
  }

  emitGuardDecision(ctx.toolName, POLICY_VERSION, governedState, 'allowed', undefined);
  return { allow: true };
}
