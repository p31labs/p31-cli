#!/usr/bin/env node
/**
 * L5-H / L7-H evidence generator.
 *
 * Exercises the REAL wired path (`executeUnifiedTool` in the built dist) so
 * L7 evidence contains events produced by actual MCP tool calls, not fixtures.
 * Then exports/verifies/tampers a COSE_Sign1 artifact for L5-H.
 *
 * Run from the repo root after `npm run build`:
 *
 *   rm -rf /tmp/opencode/l5l7-evidence
 *   GUARD_AUDIT_DIR=/tmp/opencode/l5l7-evidence \
 *   GUARD_AUDIT_FILE=/tmp/opencode/l5l7-evidence/guard-audit.jsonl \
 *   node scripts/evidence-l5h-l7h.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  executeUnifiedTool,
  readAuditLog,
  getPublicKey,
  traceContext,
  exportCOSE,
  verifyCOSE,
  verifyProofFile,
  verifyGuardChain,
} from '../dist/mcp-bridge.js';

const ROOT = process.cwd();
const EVIDENCE = process.env.P31_EVIDENCE_ROOT || '/home/p31/DOCS/evidence';
const L5 = path.join(EVIDENCE, 'L5');
const L7 = path.join(EVIDENCE, 'L7');
const TMP = '/tmp/opencode';
fs.mkdirSync(L5, { recursive: true });
fs.mkdirSync(L7, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const json = (v) => JSON.stringify(v, null, 2);

function write(file, content) {
  fs.writeFileSync(file, content);
  console.log(`wrote ${file}`);
}

// ─── 1. Live MCP tool calls (real wired emission path) ─────────────────────
const calls = [
  { sessionId: 'sess-alpha', name: 'truth_lookup', args: { key: 'verify-baseline' } },
  { sessionId: 'sess-alpha', name: 'truth_lookup', args: { key: 'care-score-formula' } },
  { sessionId: 'sess-alpha', name: 'dome_structure', args: {} },
  { sessionId: 'sess-beta', name: 'truth_lookup', args: { key: 'header-height' } },
  { sessionId: 'sess-beta', name: 'truth_invariants', args: {} },
];

console.log('=== L7 live MCP calls via executeUnifiedTool ===');
for (const call of calls) {
  const result = executeUnifiedTool(call.name, call.args, { sessionId: call.sessionId });
  console.log(`  ${call.sessionId} ${call.name} -> ${JSON.stringify(result).slice(0, 100)}`);
}

const entries = readAuditLog();
if (entries.length !== calls.length) {
  throw new Error(`Expected ${calls.length} audit events, got ${entries.length}`);
}
for (const entry of entries) {
  if (entry.version !== '2') throw new Error(`Expected v2 event at seq ${entry.seq}, got ${entry.version}`);
  if (!entry.sessionId) throw new Error(`Missing sessionId at seq ${entry.seq}`);
  const sources = entry.context_provenance?.retrievedSources || [];
  if (sources.length !== 1) throw new Error(`Expected 1 retrieved source at seq ${entry.seq}, got ${sources.length}`);
  if (!sources[0].contentHash || sources[0].contentHash.length !== 64) {
    throw new Error(`Invalid contentHash at seq ${entry.seq}`);
  }
}

const pubKey = getPublicKey();
const chain = verifyGuardChain(entries, pubKey);
if (!chain.valid) throw new Error(`Guard chain invalid: ${chain.error}`);

write(path.join(L7, 'live-attribution-sample.json'), json({
  generated_by: 'scripts/evidence-l5h-l7h.mjs (node dist/mcp-bridge.js)',
  generated_at: new Date().toISOString(),
  path: 'executeUnifiedTool(name, args, { sessionId }) -> executionGuard -> emitGuardDecision',
  note: 'Real events, not fixtures. Each event is a v2 GuardDecisionRecord with sessionId and context_provenance.retrievedSources derived from the actual tool result (sha256(JSON.stringify(result))).',
  chain_verification: chain,
  entries,
}) + '\n');

// ─── 2. Session filtering ──────────────────────────────────────────────────
const traceAlpha = traceContext(entries, 'sess-alpha');
const traceBeta = traceContext(entries, 'sess-beta');
const traceAll = traceContext(entries);
const alphaIds = traceAlpha.entries.map((e) => e.sessionId);
const betaIds = traceBeta.entries.map((e) => e.sessionId);
if (alphaIds.some((id) => id !== 'sess-alpha')) throw new Error('Alpha trace leaked another session');
if (betaIds.some((id) => id !== 'sess-beta')) throw new Error('Beta trace leaked another session');

write(path.join(L7, 'session-filter-trace.json'), json({
  generated_by: 'scripts/evidence-l5h-l7h.mjs',
  generated_at: new Date().toISOString(),
  command: "traceContext(entries, sessionId)",
  sessions: {
    'sess-alpha': traceAlpha,
    'sess-beta': traceBeta,
  },
  unfiltered_summary: traceAll.summary,
  assertions: {
    alpha_only_contains_sess_alpha: alphaIds.every((id) => id === 'sess-alpha'),
    beta_only_contains_sess_beta: betaIds.every((id) => id === 'sess-beta'),
    alpha_entry_count: traceAlpha.entries.length,
    beta_entry_count: traceBeta.entries.length,
    session_filter_applied: traceAlpha.summary.sessionFilterApplied,
  },
}) + '\n');

// ─── 3. End-to-end stale detection (same source, different content) ────────
const alphaLookups = traceAlpha.entries.filter((e) => e.tool === 'truth_lookup');
const sourceId = 'p31://mcp/ground-truth:truth_lookup';
const alphaSource = traceAlpha.summary.sources.find((s) => s.sourceId === sourceId);
if (!alphaSource) throw new Error(`No trace source ${sourceId}`);
if (!alphaSource.staleDetected) throw new Error('Expected staleDetected=true for two different truth_lookup results');
if (!alphaSource.previousContentHash) throw new Error('Expected previousContentHash');

const staleLines = [
  '=== L7-H end-to-end stale detection (real MCP tool path) ===',
  `Source: ${sourceId}`,
  'Same session: sess-alpha',
  'Call 1: truth_lookup(key="verify-baseline")',
  `  contentHash: ${alphaLookups[0]?.sources?.[0]?.contentHash}`,
  'Call 2: truth_lookup(key="care-score-formula")',
  `  contentHash: ${alphaLookups[1]?.sources?.[0]?.contentHash}`,
  '',
  'traceContext(entries, "sess-alpha") summary source:',
  json(alphaSource),
  '',
  `staleDetected: ${alphaSource.staleDetected}`,
  `previousContentHash: ${alphaSource.previousContentHash}`,
  `lastContentHash: ${alphaSource.contentHash}`,
  '',
  'Interpretation: the two calls used the same stable sourceId but returned different',
  'content. traceContext flags the second consumption as stale and retains the previous',
  'hash so a reviewer can pinpoint what changed.',
];
write(path.join(L7, 'stale-e2e.txt'), staleLines.join('\n') + '\n');

// ─── 4. COSE_Sign1 export / verify / tamper ────────────────────────────────
const cosePath = path.join(L5, 'cose-sample.cose');
const coseHash = exportCOSE(cosePath, entries, pubKey);
write(path.join(L5, 'cose-public-key.pem'), pubKey);

const coseResult = verifyCOSE(cosePath, pubKey);
const proofResult = verifyProofFile(cosePath, pubKey);
if (!coseResult.valid) throw new Error(`COSE verify failed: ${coseResult.error}`);
if (!proofResult.valid) throw new Error(`verifyProofFile(.cose) failed: ${proofResult.error}`);

// Tamper: flip the final byte (inside the last statement's signature).
const raw = fs.readFileSync(cosePath);
const tampered = Buffer.from(raw);
const tamperOffset = tampered.length - 1;
const before = tampered[tamperOffset];
tampered[tamperOffset] = before ^ 0xff;
const tamperedPath = path.join(TMP, 'l5l7-cose-tampered.cose');
fs.writeFileSync(tamperedPath, tampered);

const tamperedResult = verifyCOSE(tamperedPath, pubKey);
const tamperedProofResult = verifyProofFile(tamperedPath, pubKey);
if (tamperedResult.valid) throw new Error('Tampered COSE unexpectedly verified');
if (tamperedProofResult.valid) throw new Error('Tampered COSE unexpectedly passed verifyProofFile');

const cliCose = path.join(TMP, 'l5l7-cli-cose.cose');
let cliExportOut = '';
let cliVerifyOut = '';
let cliTamperOut = '';
let cliTamperExit = 0;
try {
  cliExportOut = execFileSync(process.execPath, ['dist/index.js', 'audit', 'export', 'cose', '-o', cliCose], {
    cwd: ROOT, encoding: 'utf-8',
  });
  cliVerifyOut = execFileSync(process.execPath, ['dist/index.js', 'audit', 'verify-proof', cliCose, '--key', path.join(L5, 'cose-public-key.pem')], {
    cwd: ROOT, encoding: 'utf-8',
  });
  try {
    cliTamperOut = execFileSync(process.execPath, ['dist/index.js', 'audit', 'verify-proof', tamperedPath, '--key', path.join(L5, 'cose-public-key.pem')], {
      cwd: ROOT, encoding: 'utf-8', stdio: 'pipe',
    });
  } catch (e) {
    cliTamperExit = e.status ?? 1;
    cliTamperOut = `${e.stdout || ''}${e.stderr || ''}`;
  }
} catch (e) {
  console.error('CLI round-trip failed:', e.stdout || '', e.stderr || '', e.message);
  throw e;
}

const verificationLines = [
  '=== L5-H COSE_Sign1 verification transcript ===',
  `Generated: ${new Date().toISOString()}`,
  'Generator: scripts/evidence-l5h-l7h.mjs (built dist/mcp-bridge.js)',
  `Artifact: ${cosePath}`,
  `Public key: ${path.join(L5, 'cose-public-key.pem')}`,
  '',
  'Wire format:',
  '  framing   : "P31COSE1" (8 ASCII bytes) | uint32 BE statement count | repeated',
  '              { uint32 BE frame length | standalone CBOR tag-18 COSE_Sign1 }',
  '  protected : CBOR map { 1: -8 (EdDSA), 4: kid }',
  '  kid       : first 8 bytes of SHA-256(DER-encoded SPKI public key)',
  '  payload   : UTF-8 bytes of canonical AIR-adapter JSON (canonicalJson)',
  '  signature : Ed25519 over CBOR(["Signature1", protected_bstr, h\'\', payload_bstr])',
  '',
  `COSE file SHA-256: ${coseHash}`,
  `File size: ${raw.length} bytes`,
  `Statement count: ${coseResult.diagnostics?.statement_count}`,
  `Framing detected: ${coseResult.diagnostics?.framing}`,
  `Expected kid: ${coseResult.diagnostics?.kid}`,
  '',
  'verifyCOSE() result:',
  json(coseResult),
  '',
  'verifyProofFile(<file.cose>) result:',
  json(proofResult),
  '',
  'CLI export (p31 audit export cose):',
  cliExportOut.trim(),
  '',
  'CLI verify-proof (valid artifact):',
  cliVerifyOut.trim(),
  '',
  'Draft alignment (see DRAFT-PINNING.md): adapter-level only, not SCITT registration.',
];
write(path.join(L5, 'cose-verification-transcript.txt'), verificationLines.join('\n') + '\n');

const roundtripLines = [
  '=== L5-H COSE round-trip and tamper test ===',
  `Generated: ${new Date().toISOString()}`,
  '',
  '1) Export -> verify',
  `   exportCOSE(${cosePath}, entries[${entries.length}], publicKey)`,
  `   export SHA-256: ${coseHash}`,
  `   verifyCOSE: valid=${coseResult.valid} statements=${coseResult.diagnostics?.statement_count}`,
  `   verifyProofFile: valid=${proofResult.valid} format=${proofResult.diagnostics?.format}`,
  `   CLI verify-proof exit: 0`,
  '',
  '2) Single-byte tamper',
  `   source: ${cosePath}`,
  `   tampered copy: ${tamperedPath}`,
  `   byte offset ${tamperOffset}: 0x${before.toString(16).padStart(2, '0')} -> 0x${tampered[tamperOffset].toString(16).padStart(2, '0')}`,
  `   verifyCOSE: valid=${tamperedResult.valid}`,
  `   error: ${tamperedResult.error}`,
  `   verifyProofFile: valid=${tamperedProofResult.valid} error=${tamperedProofResult.error}`,
  `   CLI verify-proof exit: ${cliTamperExit}`,
  '   CLI output:',
  cliTamperOut.trim().split('\n').map((l) => `     ${l}`).join('\n'),
  '',
  '3) G2 backward compatibility',
  `   JSONL chain verify after COSE export: valid=${chain.valid} lastValidSeq=${chain.lastValidSeq}`,
  `   v2 events carry optional sessionId; v1 events without it still verify (see vitest output).`,
];
write(path.join(L5, 'cose-roundtrip-and-tamper.txt'), roundtripLines.join('\n') + '\n');

console.log('\nL5/L7 evidence generated.');
console.log(`  COSE: ${cosePath}`);
console.log(`  L7:   ${L7}`);
