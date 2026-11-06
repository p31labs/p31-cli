process.env.GUARD_AUDIT_FILE = '/tmp/opencode/guard-audit-test.jsonl';
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { emitGuardDecision, verifyGuardChain, readAuditLog, getPublicKey } from '../../src/safety/guard-audit.js';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const AUDIT_FILE = '/tmp/opencode/guard-audit-test.jsonl';

describe('Guard Audit — Hash Chain', () => {
  // Clean up audit file before all tests and before each test
  beforeAll(() => {
    try { if (existsSync(process.env.GUARD_AUDIT_FILE!)) unlinkSync(process.env.GUARD_AUDIT_FILE!); } catch {}
  });
  beforeEach(() => {
    try { if (existsSync(process.env.GUARD_AUDIT_FILE!)) unlinkSync(process.env.GUARD_AUDIT_FILE!); } catch {}
  });

  it('emits a decision record with correct fields', () => {
    const record = emitGuardDecision('oasis_execute', '2026.10.1', { spoons: 3, crisis_flags: 0 }, 'allowed', undefined);
    expect(record.tool).toBe('oasis_execute');
    expect(record.verdict).toBe('allowed');
    expect(record.policy_version).toBe('2026.10.1');
    expect(record.prev_hash).toBe('b6b5c94666c3699541d22feda7c7e71d16641e76104f36c015bc8490aa24a8be');
    expect(record.data_hash).toHaveLength(64);
    expect(record.signature).toBeTruthy();
    expect(record.seq).toBe(0);
  });

  it('chains multiple decisions', () => {
    const r1 = emitGuardDecision('oasis_execute', '2026.10.1', { spoons: 3, crisis_flags: 0 }, 'allowed');
    const r2 = emitGuardDecision('love_anchor', '2026.10.1', { spoons: 2, crisis_flags: 0 }, 'elicitation_required', 'Low spoons');
    expect(r2.prev_hash).toBe(r1.data_hash);
    expect(r2.seq).toBe(1);
  });

  it('verifies a valid chain', () => {
    emitGuardDecision('oasis_execute', '2026.10.1', { spoons: 3, crisis_flags: 0 }, 'allowed');
    emitGuardDecision('love_anchor', '2026.10.1', { spoons: 2, crisis_flags: 0 }, 'elicitation_required', 'Low spoons');
    emitGuardDecision('truth_lookup', '2026.10.1', { spoons: 1, crisis_flags: 1 }, 'blocked', 'Crisis');

    const entries = readAuditLog();
    const result = verifyGuardChain(entries, getPublicKey());
    expect(result.valid).toBe(true);
    expect(result.lastValidSeq).toBe(2);
  });

  it('detects tampering', () => {
    emitGuardDecision('oasis_execute', '2026.10.1', { spoons: 3, crisis_flags: 0 }, 'allowed');
    emitGuardDecision('love_anchor', '2026.10.1', { spoons: 2, crisis_flags: 0 }, 'elicitation_required', 'Low spoons');

    const entries = readAuditLog();
    // Tamper with verdict in entry 1
    entries[1].verdict = 'allowed';

    const result = verifyGuardChain(entries, getPublicKey());
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Hash mismatch');
  });

  it('detects deleted entry', () => {
    emitGuardDecision('oasis_execute', '2026.10.1', { spoons: 3, crisis_flags: 0 }, 'allowed');
    emitGuardDecision('love_anchor', '2026.10.1', { spoons: 2, crisis_flags: 0 }, 'elicitation_required', 'Low spoons');
    emitGuardDecision('truth_lookup', '2026.10.1', { spoons: 1, crisis_flags: 1 }, 'blocked', 'Crisis');

    const entries = readAuditLog();
    // Delete entry 1 (middle)
    const tampered = [entries[0], entries[2]];

    const result = verifyGuardChain(tampered, getPublicKey());
    expect(result.valid).toBe(false);
    expect(result.error).toContain('prev_hash mismatch');
  });

  it('detects forged signature', () => {
    emitGuardDecision('oasis_execute', '2026.10.1', { spoons: 3, crisis_flags: 0 }, 'allowed');

    const entries = readAuditLog();
    // Replace signature with garbage
    entries[0].signature = 'AAAA' + entries[0].signature.slice(4);

    const result = verifyGuardChain(entries, getPublicKey());
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Signature verification failed');
  });

  it('handles empty chain', () => {
    const result = verifyGuardChain([], getPublicKey());
    expect(result.valid).toBe(true);
    expect(result.lastValidSeq).toBe(-1);
  });

  it('readAuditLog returns all entries', () => {
    emitGuardDecision('oasis_execute', '2026.10.1', { spoons: 3, crisis_flags: 0 }, 'allowed');
    emitGuardDecision('love_anchor', '2026.10.1', { spoons: 2, crisis_flags: 0 }, 'elicitation_required', 'Low spoons');

    const entries = readAuditLog();
    expect(entries.length).toBe(2);
    expect(entries[0].tool).toBe('oasis_execute');
    expect(entries[1].tool).toBe('love_anchor');
  });
});
