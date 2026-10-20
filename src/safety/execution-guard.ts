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
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const POLICY_VERSION = '2026.10.1';
const SAVED_PERMISSIONS_PATH = join(homedir(), '.p31', 'saved-permissions.json');

/**
 * Has the human already saved an "allow always" rule for this tool? Written by
 * the permission-sync OpenCode plugin (permission.replied → always). A saved
 * allow is an explicit human authorization: the guard skips elicitation but
 * still records the decision.
 */
function hasSavedAllow(toolName: string): boolean {
  try {
    if (!existsSync(SAVED_PERMISSIONS_PATH)) return false;
    const parsed = JSON.parse(readFileSync(SAVED_PERMISSIONS_PATH, 'utf8'));
    const perms = Array.isArray(parsed?.permissions) ? parsed.permissions : [];
    return perms.some((p: any) => p.effect === 'allow' && p.type === toolName);
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
    if (hasSavedAllow(ctx.toolName)) {
      emitGuardDecision(ctx.toolName, POLICY_VERSION, governedState, 'allowed', 'saved allow (permission-sync)');
      return { allow: true };
    }
    const reason = 'Crisis signals detected. Confirm you want to proceed with this action.';
    emitGuardDecision(ctx.toolName, POLICY_VERSION, governedState, 'elicitation_required', reason);
    return { allow: true, requireElicitation: true, reason };
  }

  // 3. Block on-chain writes at spoons <= 2 unless explicitly confirmed
  if (ctx.toolName === 'love_anchor' && ctx.spoonLevel <= 2) {
    if (hasSavedAllow(ctx.toolName)) {
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
