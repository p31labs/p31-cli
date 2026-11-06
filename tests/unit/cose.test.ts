process.env.GUARD_AUDIT_FILE = '/tmp/opencode/cose-test-guard-audit.jsonl';

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { existsSync, unlinkSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import {
  CborTag,
  decodeCBOR,
  decodeCOSESign1,
  encodeCBOR,
  encodeCOSESign1,
  decodeFramedCOSE,
  encodeFramedCOSE,
  encodeSigStructure,
  looksLikeP31COSE,
} from '../../src/safety/cose.js';
import {
  emitGuardDecision,
  exportCOSE,
  getPublicKey,
  readAuditLog,
  verifyCOSE,
  verifyGuardChain,
  verifyProofFile,
} from '../../src/safety/guard-audit.js';

const AUDIT_FILE = '/tmp/opencode/cose-test-guard-audit.jsonl';
const COSE_FILE = '/tmp/opencode/cose-test-sample.cose';
const TAMPER_FILE = '/tmp/opencode/cose-test-tampered.cose';

function cleanup(path: string) {
  try { if (existsSync(path)) unlinkSync(path); } catch { /* ignore */ }
}

describe('Minimal CBOR', () => {
  it('round-trips supported types', () => {
    const values: any[] = [
      0, 23, 24, 255, 256, 65535, 65536, 4294967295, 4294967296,
      -1, -24, -25, -256, -65536,
      'hello', '', true, false, null,
      Buffer.from([1, 2, 3]),
      [1, 'two', Buffer.from([3])],
      new Map<any, any>([[1, -8], ['kid', Buffer.from([9, 9])]]),
      new CborTag(18, ['x']),
    ];
    for (const value of values) {
      const encoded = encodeCBOR(value);
      const decoded = decodeCBOR(encoded);
      expect(decoded.bytesRead).toBe(encoded.length);
      if (value instanceof Map) {
        expect(decoded.value).toBeInstanceOf(Map);
        expect((decoded.value as Map<any, any>).get(1)).toBe(-8);
      } else if (value instanceof CborTag) {
        expect(decoded.value).toBeInstanceOf(CborTag);
        expect((decoded.value as CborTag).tag).toBe(18);
      } else {
        expect(decoded.value).toEqual(value);
      }
    }
  });

  it('rejects unsupported values and indefinite length', () => {
    expect(() => encodeCBOR(1.5 as any)).toThrow(/safe integers/);
    expect(() => decodeCBOR(Buffer.from([0x5f]))).toThrow(/indefinite/);
  });
});

describe('COSE_Sign1', () => {
  beforeAll(() => {
    mkdirSync('/tmp/opencode', { recursive: true });
    cleanup(AUDIT_FILE);
    cleanup(COSE_FILE);
    cleanup(TAMPER_FILE);
  });
  beforeEach(() => cleanup(AUDIT_FILE));

  it('encodes/decodes a tag-18 structure and Sig_structure', () => {
    const protectedBytes = Buffer.from([0xa1, 0x01, 0x27]); // {1: -8}
    const payload = Buffer.from('payload');
    const sigStruct = encodeSigStructure(protectedBytes, payload);
    const decodedSig = decodeCBOR(sigStruct).value as any[];
    expect(decodedSig[0]).toBe('Signature1');
    expect(Buffer.from(decodedSig[1]).equals(protectedBytes)).toBe(true);
    expect(Buffer.from(decodedSig[2]).length).toBe(0);
    expect(Buffer.from(decodedSig[3]).toString()).toBe('payload');

    const cose = encodeCOSESign1(protectedBytes, new Map(), payload, Buffer.from([1, 2]));
    const parsed = decodeCOSESign1(cose);
    expect(parsed.payload.toString()).toBe('payload');
    expect(parsed.signature).toEqual(Buffer.from([1, 2]));
    expect((parsed.protectedHeader as Map<any, any>).get(1)).toBe(-8);
  });

  it('frames statements deterministically', () => {
    const frames = [Buffer.from([0xd2, 0x00]), Buffer.from([0xd2, 0x01])];
    const framed = encodeFramedCOSE(frames);
    expect(looksLikeP31COSE(framed)).toBe(true);
    const decoded = decodeFramedCOSE(framed);
    expect(decoded.frames.map(f => f.toString('hex'))).toEqual(['d200', 'd201']);
  });

  it('exports, verifies and detects tampering in .cose files', () => {
    emitGuardDecision('truth_lookup', '2026.10.1', { spoons: 3, crisis_flags: 0 }, 'allowed', undefined, {
      sessionId: 'cose-test-session',
      instructionSource: 'mcp',
      instructionHash: 'abc',
      retrievedSources: [{ sourceId: 'p31://mcp/ground-truth:truth_lookup', contentHash: 'h1' }],
    });
    emitGuardDecision('dome_structure', '2026.10.1', { spoons: 2, crisis_flags: 0 }, 'allowed', undefined, {
      sessionId: 'cose-test-session',
      instructionSource: 'mcp',
      instructionHash: 'def',
    });

    const entries = readAuditLog();
    const pub = getPublicKey();
    const hash = exportCOSE(COSE_FILE, entries, pub);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    const verified = verifyCOSE(COSE_FILE, pub);
    expect(verified.valid).toBe(true);
    expect(verified.diagnostics.format).toBe('p31-cose-sign1');
    expect(verified.diagnostics.statement_count).toBe(2);
    expect(verified.diagnostics.kid).toMatch(/^[0-9a-f]{16}$/);

    const viaProof = verifyProofFile(COSE_FILE, pub);
    expect(viaProof.valid).toBe(true);
    expect(viaProof.diagnostics.format).toBe('p31-cose-sign1');

    // Flip one payload byte (inside frame 0) — signature must fail with an index.
    const raw = readFileSync(COSE_FILE);
    const tampered = Buffer.from(raw);
    tampered[20] = tampered[20] ^ 0xff;
    writeFileSync(TAMPER_FILE, tampered);
    const bad = verifyCOSE(TAMPER_FILE, pub);
    expect(bad.valid).toBe(false);
    expect(bad.error).toMatch(/COSE statement 0/);

    // The JSONL chain path is unaffected by sessionId being present.
    expect(verifyGuardChain(entries, pub).valid).toBe(true);
  });
});
