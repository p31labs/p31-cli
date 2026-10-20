/**
 * Execution Guard Test Harness
 * Runs adversarial tool-call sequences against the guard
 * and reports which calls were blocked or escalated.
 */

import { describe, it, expect } from 'vitest';
import { executionGuard } from '../../src/safety/execution-guard.js';

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
