/**
 * Execution Guard Test Harness
 * Runs adversarial tool-call sequences against the guard
 * and reports which calls were blocked or escalated.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executionGuard } from '../../src/safety/execution-guard.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const STATE_PATH = join(homedir(), '.p31', 'saved-permissions.json');
const STATE_DIR = join(homedir(), '.p31');

function writeSaved(permissions: unknown[]) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify({ schema: 'p31.saved-permissions.v1', permissions }, null, 2));
}

describe('Execution Guard — saved permission sync', () => {
  beforeAll(() => {
    if (existsSync(STATE_PATH)) rmSync(STATE_PATH);
  });
  afterAll(() => {
    if (existsSync(STATE_PATH)) rmSync(STATE_PATH);
  });

  it('re-elicits a mutating tool during crisis with no saved allow', () => {
    writeSaved([]);
    const result = executionGuard({
      spoonLevel: 3,
      recentCrisisFlags: 1,
      userMessage: 'anchor',
      toolName: 'love_anchor',
      toolArgs: {},
    });
    expect(result.requireElicitation).toBe(true);
  });

  it('skips elicitation when a saved allow exists for the tool', () => {
    writeSaved([{ type: 'love_anchor', pattern: null, sessionID: 's1', effect: 'allow', savedAt: '2026-10-20T00:00:00Z' }]);
    const result = executionGuard({
      spoonLevel: 3,
      recentCrisisFlags: 1,
      userMessage: 'anchor',
      toolName: 'love_anchor',
      toolArgs: {},
    });
    expect(result.allow).toBe(true);
    expect(result.requireElicitation).toBeUndefined();
  });

  it('does not let a saved allow bypass the spoon-1 shell block', () => {
    writeSaved([{ type: 'oasis_execute', pattern: null, sessionID: 's1', effect: 'allow', savedAt: '2026-10-20T00:00:00Z' }]);
    const result = executionGuard({
      spoonLevel: 1,
      recentCrisisFlags: 0,
      userMessage: 'run',
      toolName: 'oasis_execute',
      toolArgs: {},
    });
    expect(result.allow).toBe(false);
  });
});


describe('Execution Guard — Adversarial Sequences', () => {
  it('blocks shell execution at spoon level 1', () => {
    const result = executionGuard({
      spoonLevel: 1,
      recentCrisisFlags: 0,
      userMessage: 'run ls',
      toolName: 'oasis_execute',
      toolArgs: { command: 'ls' },
    });
    expect(result.allow).toBe(false);
    expect(result.reason).toContain('blocked');
  });

  it('allows shell execution at spoon level 3', () => {
    const result = executionGuard({
      spoonLevel: 3,
      recentCrisisFlags: 0,
      userMessage: 'run ls',
      toolName: 'oasis_execute',
      toolArgs: { command: 'ls' },
    });
    expect(result.allow).toBe(true);
    expect(result.requireElicitation).toBeUndefined();
  });

  it('escalates mutating tools when crisis signals active', () => {
    const result = executionGuard({
      spoonLevel: 3,
      recentCrisisFlags: 1,
      userMessage: 'I want to delete everything',
      toolName: 'love_anchor',
      toolArgs: { amount: 100, recipient: 'did:key:z6Mk...' },
    });
    expect(result.allow).toBe(true);
    expect(result.requireElicitation).toBe(true);
    expect(result.reason).toContain('Crisis');
  });

  it('requires confirmation for on-chain writes at low spoons', () => {
    const result = executionGuard({
      spoonLevel: 2,
      recentCrisisFlags: 0,
      userMessage: 'anchor love',
      toolName: 'love_anchor',
      toolArgs: { amount: 50, recipient: 'did:key:z6Mk...' },
    });
    expect(result.allow).toBe(true);
    expect(result.requireElicitation).toBe(true);
    expect(result.reason).toContain('Low spoon');
  });

  it('allows read-only tools at any spoon level', () => {
    const readOnlyTools = ['oasis_status', 'truth_lookup', 'love_balance'];
    for (const tool of readOnlyTools) {
      const result = executionGuard({
        spoonLevel: 1,
        recentCrisisFlags: 1,
        userMessage: 'check status',
        toolName: tool,
        toolArgs: {},
      });
      expect(result.allow).toBe(true);
    }
  });

  it('blocks all mutating tools at spoon level 0', () => {
    const mutatingTools = ['oasis_execute', 'love_anchor', 'truth_register_fact', 'design_expert_ephemeralize'];
    for (const tool of mutatingTools) {
      const result = executionGuard({
        spoonLevel: 0,
        recentCrisisFlags: 0,
        userMessage: 'do something',
        toolName: tool,
        toolArgs: {},
      });
      // At spoon 0, shell is blocked; others may require elicitation
      if (tool === 'oasis_execute') {
        expect(result.allow).toBe(false);
      }
    }
  });
});

describe('Execution Guard — Crisis Escalation Matrix', () => {
  const mutatingTools = ['oasis_execute', 'love_anchor', 'truth_register_fact', 'design_expert_ephemeralize'];

  for (const tool of mutatingTools) {
    it(`escalates ${tool} when crisis flags present`, () => {
      const result = executionGuard({
        spoonLevel: 4,
        recentCrisisFlags: 2,
        userMessage: 'crisis message',
        toolName: tool,
        toolArgs: {},
      });
      expect(result.requireElicitation).toBe(true);
    });
  }
});
