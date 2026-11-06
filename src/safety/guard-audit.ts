/**
 * Guard Audit — Three-Dimensional Provenance Signed, hash-chained audit log
 *
 * Extends the original chainproof audit from action-only to
 * action + model + context provenance, with offline-verifiable
 * W3C PROV-JSONLD and Merkle-root evidence bundle export.
 *
 * - SHA-256 hash chain with Ed25519 signatures per entry
 * - Genesis anchor: SHA-256('chainproof:genesis')
 * - UUIDv7 IDs (randomUUID fallback), monotonic seq, canonical JSON serialization
 * - Append-only JSONL log at ~/.p31/guard-audit.jsonl
 * - v1 events still verify (backward compatible)
 * - v2 events add model_provenance and context_provenance dimensions
 */

import { createHash, generateKeyPairSync, randomUUID, createPrivateKey, createPublicKey, sign as cryptoSign, verify as cryptoVerify } from 'node:crypto';
import { appendFileSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  COSESign1Structure,
  decodeCOSESign1,
  decodeFramedCOSE,
  encodeCOSESign1,
  encodeProtectedHeader,
  encodeSigStructure,
  encodeFramedCOSE,
  looksLikeP31COSE,
} from './cose.js';

function getAuditDir(): string { return process.env.GUARD_AUDIT_DIR || join(homedir(), '.p31'); }
const AUDIT_DIR = getAuditDir();
function getAuditFile(): string { return process.env.GUARD_AUDIT_FILE || join(AUDIT_DIR, 'guard-audit.jsonl'); }
const GENESIS_HASH = createHash('sha256').update('chainproof:genesis').digest('hex');

export interface ModelProvenance {
  bucket: string;
  candidatesConsidered: string[];
  selectedModel: string;
  selectedProvider: string;
  selectionReason: string;
  fallbackDepth: number;
  latencyMs: number;
  errorClass?: string;
}

export interface RetrievedSourceRecord {
  sourceId: string;
  contentHash: string;
  freshness: 'FRESH' | 'STALE';
  validity: 'VALID' | 'MISSING' | 'INCOMPLETE';
  retrievedAt?: string;
  serverUrl?: string;
  toolCallId?: string;
  /** L7-J: SHA-256 of the tool description at attribution time (tool-poisoning governance heuristic). */
  descriptionHash?: string;
  /** L7-J: heuristic flag from description inspection; not a complete TDP defense. */
  descriptionPoisoningRisk?: 'none' | 'suspicious' | 'high';
}

export interface ContextProvenance {
  instructionSource: string;
  instructionHash: string;
  retrievedSources: RetrievedSourceRecord[];
}

/**
 * L7 helper: normalize/mark retrieved source records for MCP callers.
 * Expected shape per source: { sourceId, contentHash, freshness?, validity?, retrievedAt?, serverUrl?, toolCallId?, descriptionHash?, descriptionPoisoningRisk? }.
 * - `sourceId` (required): stable identifier for the source (e.g., MCP server+resource, doc path).
 * - `contentHash` (required): hash of retrieved content/version (hex recommended).
 * - `freshness`: 'FRESH'|'STALE' (default 'FRESH'; stale detection also flags hash changes across consumptions).
 * - `validity`: 'VALID'|'MISSING'|'INCOMPLETE' (default 'VALID').
 * - `retrievedAt`: ISO timestamp.
 * - `serverUrl` / `toolCallId`: MCP attribution for independent lookup.
 * - `descriptionHash` / `descriptionPoisoningRisk`: L7-J tool-description governance (heuristic).
 */
export function markRetrievedSources(
  sources: Array<Partial<RetrievedSourceRecord> & { sourceId: string; contentHash: string }>
): RetrievedSourceRecord[] {
  return (sources || []).map((s) => ({
    sourceId: String(s.sourceId),
    contentHash: String(s.contentHash),
    freshness: s.freshness === 'STALE' ? 'STALE' : 'FRESH',
    validity: s.validity === 'MISSING' || s.validity === 'INCOMPLETE' ? s.validity : 'VALID',
    ...(s.retrievedAt ? { retrievedAt: s.retrievedAt } : {}),
    ...(s.serverUrl ? { serverUrl: s.serverUrl } : {}),
    ...(s.toolCallId ? { toolCallId: s.toolCallId } : {}),
    ...(s.descriptionHash ? { descriptionHash: String(s.descriptionHash) } : {}),
    ...(s.descriptionPoisoningRisk === 'suspicious' || s.descriptionPoisoningRisk === 'high' || s.descriptionPoisoningRisk === 'none'
      ? { descriptionPoisoningRisk: s.descriptionPoisoningRisk }
      : {}),
  }));
}

export interface GuardDecisionRecord {
  /** '1' for legacy events, '2' for v2 events with full provenance */
  version?: '1' | '2';
  id: string;
  seq: number;
  timestamp: string;
  tool: string;
  /** SHA-256 of tool arguments/context (action dimension) — present in v2 */
  argsHash?: string;
  /** Verdict: allowed | blocked | elicitation_required (action dimension) */
  guardVerdict?: 'allowed' | 'blocked' | 'elicitation_required';
  /** Policy version / ID (action dimension) */
  policyId?: string;
  /** Legacy field — alias for guardVerdict */
  verdict: 'allowed' | 'blocked' | 'elicitation_required';
  /** Legacy field — alias for policyId */
  policy_version: string;
  /**
   * L7: session correlation id (v2 only). Optional so v1/legacy events remain
   * verifiable; when present it is included in the v2 hash object.
   */
  sessionId?: string;
  reason?: string;
  governed_state: {
    spoons: number;
    crisis_flags: number;
    fetched_at: string;
  };
  prev_hash: string;
  data_hash: string;
  signature: string;
  /** Three-dimensional provenance dimensions (v2 only) */
  model_provenance?: ModelProvenance;
  context_provenance?: ContextProvenance;
}

// Ed25519 key pair for signing
let _privateKey: string | null = null;
let _publicKey: string | null = null;

function ensureKeys(): { privateKey: string; publicKey: string } {
  if (_privateKey && _publicKey) return { privateKey: _privateKey, publicKey: _publicKey };

  const keyPath = join(getAuditDir(), 'guard-key.pem');
  const pubPath = join(getAuditDir(), 'guard-pub.pem');
  if (existsSync(keyPath) && existsSync(pubPath)) {
    _privateKey = readFileSync(keyPath, 'utf-8');
    _publicKey = readFileSync(pubPath, 'utf-8');
    return { privateKey: _privateKey, publicKey: _publicKey };
  }

  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  _privateKey = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  _publicKey = publicKey.export({ type: 'spki', format: 'pem' }) as string;

  mkdirSync(getAuditDir(), { recursive: true });
  writeFileSync(keyPath, _privateKey);
  writeFileSync(pubPath, _publicKey);

  return { privateKey: _privateKey, publicKey: _publicKey };
}

function canonicalJson(obj: any): string {
  const sorted = sortKeys(obj);
  return JSON.stringify(sorted);
}

function sortKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === 'object') {
    const sorted: any = {};
    for (const key of Object.keys(obj).sort()) {
      if (key === 'signature' || key === 'data_hash' || key === 'prev_hash') continue;
      sorted[key] = sortKeys(obj[key]);
    }
    return sorted;
  }
  return obj;
}

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function signData(data: string, privateKeyPem: string): string {
  const key = createPrivateKey(privateKeyPem);
  const sig = cryptoSign(null, Buffer.from(data), key);
  return sig.toString('base64');
}

function verifySignature(data: string, signature: string, publicKeyPem: string): boolean {
  try {
    const key = createPublicKey(publicKeyPem);
    return cryptoVerify(null, Buffer.from(data), key, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}

function sha256Buffer(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function publicKeyDer(publicKeyPem: string): Buffer {
  return createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' }) as Buffer;
}

/**
 * COSE `kid` = first 8 bytes of SHA-256 over the DER-encoded SPKI public key.
 * Deterministic and independent of PEM line wrapping/whitespace.
 */
function kidForPublicKey(publicKeyPem: string): Buffer {
  return createHash('sha256').update(publicKeyDer(publicKeyPem)).digest().subarray(0, 8);
}

function verifyEd25519Over(data: Uint8Array, signature: Uint8Array, publicKeyPem: string): boolean {
  try {
    return cryptoVerify(null, Buffer.from(data), createPublicKey(publicKeyPem), Buffer.from(signature));
  } catch {
    return false;
  }
}

function getNextSeq(): number {
  if (!existsSync(getAuditFile())) return 0;
  const lines = readFileSync(getAuditFile(), 'utf-8').trim().split('\n').filter(Boolean);
  if (lines.length === 0) return 0;
  const last = JSON.parse(lines[lines.length - 1]);
  return (last.seq || 0) + 1;
}

function getPrevHash(): string {
  if (!existsSync(getAuditFile())) return GENESIS_HASH;
  const lines = readFileSync(getAuditFile(), 'utf-8').trim().split('\n').filter(Boolean);
  if (lines.length === 0) return GENESIS_HASH;
  const last = JSON.parse(lines[lines.length - 1]);
  return last.data_hash || GENESIS_HASH;
}

export function emitGuardDecision(
  tool: string,
  policyVersion: string,
  governedState: { spoons: number; crisis_flags: number },
  verdict: 'allowed' | 'blocked' | 'elicitation_required',
  reason?: string,
  options?: {
    modelBucket?: string;
    candidatesConsidered?: string[];
    selectedModel?: string;
    selectedProvider?: string;
    selectionReason?: string;
    fallbackDepth?: number;
    latencyMs?: number;
    errorClass?: string;
    instructionSource?: string;
    instructionHash?: string;
    retrievedSources?: Array<Partial<RetrievedSourceRecord> & { sourceId: string; contentHash: string }>;
    /** L7: additive session correlation; presence upgrades the event to v2. */
    sessionId?: string;
  }
): GuardDecisionRecord {
  const { privateKey } = ensureKeys();
  const now = new Date().toISOString();
  const sessionId = options?.sessionId || undefined;

  const hasProvenance = !!(options && (
    options.modelBucket || options.candidatesConsidered?.length || options.selectedModel ||
    options.selectedProvider || options.selectionReason || options.fallbackDepth !== undefined ||
    options.latencyMs !== undefined || options.errorClass || options.instructionSource ||
    options.instructionHash || options.retrievedSources?.length || sessionId
  ));
  const version: '1' | '2' = hasProvenance ? '2' : '1';

  const id = randomUUID();
  const seq = getNextSeq();
  const prevHash = getPrevHash();
  const argsHash = sha256(canonicalJson({ tool, policyId: policyVersion, verdict, reason: reason ?? null }));

  const governed_state = {
    spoons: governedState.spoons,
    crisis_flags: governedState.crisis_flags,
    fetched_at: now,
  };

  // v1: hash over legacy field set for backward compatibility
  const hashObj: Record<string, any> = version === '1'
    ? {
        id,
        seq,
        timestamp: now,
        tool,
        policy_version: policyVersion,
        governed_state,
        verdict,
        reason,
      }
    : {
        id,
        seq,
        timestamp: now,
        version,
        tool,
        sessionId,
        argsHash,
        guardVerdict: verdict,
        policyId: policyVersion,
        policy_version: policyVersion,
        governed_state,
        verdict,
        reason,
        model_provenance: {
          bucket: options?.modelBucket || 'default',
          candidatesConsidered: options?.candidatesConsidered || [],
          selectedModel: options?.selectedModel || '',
          selectedProvider: options?.selectedProvider || '',
          selectionReason: options?.selectionReason || '',
          fallbackDepth: options?.fallbackDepth ?? 0,
          latencyMs: options?.latencyMs ?? 0,
          errorClass: options?.errorClass,
        },
        context_provenance: {
          instructionSource: options?.instructionSource || 'cli',
          instructionHash: options?.instructionHash || '',
          retrievedSources: markRetrievedSources(options?.retrievedSources || []),
        },
      };

  const canonical = canonicalJson({ ...hashObj, prev_hash: prevHash });
  const dataHash = sha256(canonical);
  const signature = signData(dataHash, privateKey);

  const record: GuardDecisionRecord = version === '1'
    ? {
        id, seq, timestamp: now, version: '1', tool,
        argsHash: '', guardVerdict: verdict, policyId: policyVersion,
        policy_version: policyVersion, verdict, reason,
        governed_state, prev_hash: prevHash, data_hash: dataHash, signature,
      }
    : {
        id, seq, timestamp: now, version: '2', tool, argsHash,
        ...(sessionId ? { sessionId } : {}),
        guardVerdict: verdict, policyId: policyVersion, policy_version: policyVersion,
        governed_state, verdict, reason,
        model_provenance: hashObj.model_provenance,
        context_provenance: hashObj.context_provenance,
        prev_hash: prevHash, data_hash: dataHash, signature,
      };

  mkdirSync(getAuditDir(), { recursive: true });
  appendFileSync(getAuditFile(), JSON.stringify(record) + '\n');
  return record;
}

export function verifyGuardChain(
  entries: GuardDecisionRecord[],
  publicKeyPem: string
): { valid: boolean; lastValidSeq: number; error?: string } {
  let prevHash = GENESIS_HASH;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.prev_hash !== prevHash) {
      return { valid: false, lastValidSeq: i > 0 ? entries[i - 1].seq : -1, error: `Chain break at seq ${entry.seq}: prev_hash mismatch` };
    }

    const { prev_hash, data_hash, signature, ...rest } = entry;
    let recomputedHash = sha256(canonicalJson({ ...rest, prev_hash }));

    // Backward compatibility: v1/legacy records may have been hashed over the legacy field set
    // (without version/argsHash/guardVerdict/policyId) while the stored record includes aliases.
    if (recomputedHash !== data_hash) {
      const legacy = {
        id: entry.id, seq: entry.seq, timestamp: entry.timestamp, tool: entry.tool,
        policy_version: entry.policy_version, governed_state: entry.governed_state,
        verdict: entry.verdict, reason: entry.reason,
      };
      recomputedHash = sha256(canonicalJson({ ...legacy, prev_hash }));
    }

    if (recomputedHash !== data_hash) {
      return { valid: false, lastValidSeq: i > 0 ? entries[i - 1].seq : -1, error: `Hash mismatch at seq ${entry.seq}` };
    }

    if (!verifySignature(data_hash, signature, publicKeyPem)) {
      return { valid: false, lastValidSeq: i > 0 ? entries[i - 1].seq : -1, error: `Signature verification failed at seq ${entry.seq}` };
    }

    prevHash = data_hash;
  }

  return { valid: true, lastValidSeq: entries.length > 0 ? entries[entries.length - 1].seq : -1 };
}

export function readAuditLog(): GuardDecisionRecord[] {
  if (!existsSync(getAuditFile())) return [];
  const lines = readFileSync(getAuditFile(), 'utf-8').trim().split('\n').filter(Boolean);
  return lines.map(line => JSON.parse(line));
}

export function getPublicKey(): string {
  const { publicKey } = ensureKeys();
  return publicKey;
}

export function computeMerkleRoot(entries: GuardDecisionRecord[]): { root: string; leaves: string[] } {
  if (entries.length === 0) {
    return { root: sha256(''), leaves: [] };
  }
  const leaves: string[] = entries.map(entry => entry.data_hash);
  let nodes: string[] = [...leaves];
  while (nodes.length % 2 === 1) nodes.push(nodes[nodes.length - 1]);
  while (nodes.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < nodes.length; i += 2) nextLevel.push(sha256(nodes[i] + nodes[i + 1]));
    nodes = nextLevel;
  }
  return { root: nodes[0], leaves };
}



/** L5: AAT-compatible view (draft mapping; aliases, non-breaking) */
export function toAATCompatible(entry: GuardDecisionRecord): Record<string, any> {
  return {
    ...entry,
    agent_identity: entry.context_provenance?.instructionSource || 'p31-cli',
    action_classification: entry.tool,
    outcome: entry.verdict === 'allowed' ? 'success' : entry.verdict === 'blocked' ? 'denied' : 'pending_approval',
    trust_level: entry.model_provenance?.fallbackDepth ? 'degraded' : 'normal',
    instruction_hash: entry.context_provenance?.instructionHash || '',
  };
}

/**
 * Shared AIR/AgentInteractionRecord-adapter payload used by both the JSON
 * SCITT adapter and the COSE_Sign1 packaging. Keeping one builder guarantees
 * the two exports describe the same statement shape.
 *
 * L5-J: included an optional `redaction_receipt` field (null when absent).
 * L5-L (STAGED, pending REBUILD-2 — NOT in shipped bundle fea9a2e1…):
 * `draft_targets` demotes `draft-emirdag-scitt-ai-agent-execution-01`
 * (related individual draft, archive status unverified as of 2026-11-05;
 * -00 expired 2026-10) in favor of RFC 9942/9943-anchored targets plus the
 * mih capsule EdDSA-profile reference. Additive/non-breaking: same payload
 * shape, same verification (signatures over signed payload); existing signed
 * artifacts remain verifiable as originally signed. New exports sign the new
 * payload shape, so this change requires the subsequent atomic REBUILD-2 to
 * ship.
 * P31 does NOT claim ES256 AIR conformance (uses EdDSA/-8) and does NOT implement
 * cryptographic redaction receipts.
 */
function scittStatementPayload(e: GuardDecisionRecord, generatedAt: string): Record<string, any> {
  return {
    '@context': ['https://www.w3.org/ns/prov', 'https://p31ca.org/ns/scitt-adapter'],
    profile: 'p31-scitt-adapter/v0.1',
    draft_targets: ['rfc9942-cose-receipts', 'rfc9943-scitt-architecture', 'draft-mih-scitt-agent-action-capsule-05', 'draft-sharif-agent-audit-trail-01'],
    statement_type: 'AgentInteractionRecord-adapter',
    issued_at: generatedAt,
    agent_identity: e.context_provenance?.instructionSource || 'p31-cli',
    action: { tool: e.tool, args_hash: e.argsHash || '', classification: e.tool },
    outcome: e.verdict,
    trust_level: e.model_provenance?.fallbackDepth ? 'degraded' : 'normal',
    model_provenance: e.model_provenance || null,
    context_provenance: e.context_provenance || null,
    chain: { seq: e.seq, prev_hash: e.prev_hash, data_hash: e.data_hash, signature: e.signature },
    /** L5-J: null when no redaction occurred; object {method, redacted_content_hash} only if implemented (not in MVP). */
    redaction_receipt: null,
  };
}

/** L5: SCITT-profile-aligned signed bundle (RFC 9942/9943-anchored; JSON form). L5-L staged for REBUILD-2 (pending atomic rebuild + rehash). */
export function exportSCITT(filePath: string, entries: GuardDecisionRecord[], publicKeyPem: string): string {
  const generatedAt = new Date().toISOString();
  const { root: merkleRoot } = computeMerkleRoot(entries);
  const statements = entries.map((e) => {
    const payload = scittStatementPayload(e, generatedAt);
    const bytes = canonicalJson(payload);
    return { payload, payload_hash: sha256(bytes), ed25519_signature_over_payload_hash: signData(sha256(bytes), (()=>{const{privateKey}=ensureKeys();return privateKey;})()) };
  });
  const bundle = {
    format: 'p31-scitt-adapter',
    version: '0.1',
    spec_version: 'p31-scitt-adapter/v0.1',
    generated_by: '@p31ca/cli (guard-audit exportSCITT)',
    generated_at: generatedAt,
    draft_targets: ['rfc9942-cose-receipts', 'rfc9943-scitt-architecture', 'draft-mih-scitt-agent-action-capsule-05', 'draft-sharif-agent-audit-trail-01'],
    canonicalization: 'JCS-like via canonicalJson (recursive key sort, JSON.stringify); RFC 8785 intent. Signatures are Ed25519 over SHA-256(payload_canonical).',
    note: 'Adapter export (JSON). Structurally aligned with RFC 9943 SCITT architecture and RFC 9942 COSE Receipts; EdDSA per mih capsule-profile family; not ES256 AIR conformance; no TS registration; redaction_receipt is null when absent (no redaction attestation). L5-L draft_targets staged for REBUILD-2 (pending atomic rebuild + rehash).',
    merkle_root: merkleRoot,
    entry_count: entries.length,
    public_key_pem: publicKeyPem,
    statements,
  };
  mkdirSync(dirname(filePath), { recursive: true });
  const content = JSON.stringify(bundle, null, 2);
  writeFileSync(filePath, content);
  console.log('SCITT-adapter export (draft-aligned):', filePath);
  console.log('Spec:', bundle.spec_version, '| generated_by:', bundle.generated_by);
  console.log('Merkle root:', merkleRoot);
  console.log('Export SHA-256:', sha256(content));
  return merkleRoot;
}

/**
 * L5-H: COSE_Sign1 packaging (RFC 9052) for the same AIR-adapter statements.
 *
 * Framing (documented in `cose.ts` and evidence):
 *   "P31COSE1" (8 ASCII bytes) | uint32 BE statement count |
 *   repeated { uint32 BE frame length | standalone CBOR tag-18 COSE_Sign1 }
 *
 * Protected header = { 1: -8, 4: kid } where kid is the first 8 bytes of
 * SHA-256(DER-encoded SPKI public key). Signature = Ed25519 over
 * CBOR(["Signature1", protected_bstr, h'', payload_bstr]) with an empty
 * external_aad. Adapter-level only — this is NOT SCITT registration.
 */
export function exportCOSE(filePath: string, entries: GuardDecisionRecord[], publicKeyPem: string): string {
  const { privateKey } = ensureKeys();
  const signingKey = createPrivateKey(privateKey);

  // Refuse to emit a kid/signature pair that does not match the caller's key.
  const signingDer = createPublicKey(signingKey).export({ type: 'spki', format: 'der' }) as Buffer;
  const suppliedDer = publicKeyDer(publicKeyPem);
  if (!signingDer.equals(suppliedDer)) {
    throw new Error('exportCOSE: supplied public key does not match the active P31 signing key');
  }

  const kid = createHash('sha256').update(signingDer).digest().subarray(0, 8);
  const protectedBytes = encodeProtectedHeader(-8, kid);
  const generatedAt = new Date().toISOString();

  const frames = entries.map((e) => {
    const payload = Buffer.from(canonicalJson(scittStatementPayload(e, generatedAt)), 'utf8');
    const sigStructure = encodeSigStructure(protectedBytes, payload);
    const signature = cryptoSign(null, sigStructure, signingKey);
    return encodeCOSESign1(protectedBytes, new Map(), payload, signature);
  });

  const out = encodeFramedCOSE(frames);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, out);

  const fileHash = sha256Buffer(out);
  console.log('COSE_Sign1 export:', filePath);
  console.log(`  framing: P31COSE1 (magic + uint32 BE count + length-prefixed tag-18 frames)`);
  console.log(`  statements: ${frames.length} | alg: -8 (EdDSA) | kid: ${kid.toString('hex')}`);
  console.log(`  COSE file SHA-256: ${fileHash}`);
  return fileHash;
}

interface COSEVerifyResult {
  valid: boolean;
  error?: string;
  diagnostics?: any;
}

function verifyCOSEBuffer(raw: Buffer, publicKeyPem: string, sourceLabel: string): COSEVerifyResult {
  let frames: Buffer[];
  let framing: string;

  if (looksLikeP31COSE(raw)) {
    try {
      frames = decodeFramedCOSE(raw).frames;
      framing = 'p31-cose-framed';
    } catch (e) {
      return { valid: false, error: `COSE framing error (${sourceLabel}): ${(e as Error).message}` };
    }
  } else if (raw.length > 0 && raw[0] === 0xd2) {
    frames = [raw];
    framing = 'raw-cose-sign1';
  } else {
    return {
      valid: false,
      error: `Not a COSE_Sign1 artifact (${sourceLabel}): expected P31COSE1 framing or raw CBOR tag 18`,
    };
  }

  if (frames.length === 0) {
    return { valid: false, error: `COSE artifact contains zero statements (${sourceLabel})` };
  }
  if (!publicKeyPem) {
    return { valid: false, error: 'COSE: no public key available (pass --key or provide a bundled key)' };
  }

  let expectedKid: Buffer | undefined;
  try {
    expectedKid = kidForPublicKey(publicKeyPem);
  } catch {
    return { valid: false, error: 'COSE: supplied public key is not a valid PEM public key' };
  }

  const statements: any[] = [];
  for (let i = 0; i < frames.length; i++) {
    let cose: COSESign1Structure;
    try {
      cose = decodeCOSESign1(frames[i]);
    } catch (e) {
      return {
        valid: false,
        error: `COSE statement ${i}: decode failed: ${(e as Error).message}`,
        diagnostics: { format: 'p31-cose-sign1', framing, statement_count: frames.length, failed_statement: i, statements },
      };
    }

    const header = cose.protectedHeader;
    if (!(header instanceof Map)) {
      return {
        valid: false,
        error: `COSE statement ${i}: protected header is not a CBOR map`,
        diagnostics: { format: 'p31-cose-sign1', framing, statement_count: frames.length, failed_statement: i, statements },
      };
    }

    const alg = header.get(1);
    const kid = header.get(4);
    if (alg !== -8) {
      return {
        valid: false,
        error: `COSE statement ${i}: unsupported alg ${String(alg)} (expected -8 EdDSA)`,
        diagnostics: { format: 'p31-cose-sign1', framing, statement_count: frames.length, failed_statement: i, statements },
      };
    }
    if (kid !== undefined) {
      if (!(kid instanceof Uint8Array)) {
        return {
          valid: false,
          error: `COSE statement ${i}: kid header is not a byte string`,
          diagnostics: { format: 'p31-cose-sign1', framing, statement_count: frames.length, failed_statement: i, statements },
        };
      }
      if (!Buffer.from(kid).equals(expectedKid)) {
        return {
          valid: false,
          error: `COSE statement ${i}: kid mismatch (header ${Buffer.from(kid).toString('hex')}, key ${expectedKid.toString('hex')})`,
          diagnostics: { format: 'p31-cose-sign1', framing, statement_count: frames.length, failed_statement: i, statements },
        };
      }
    }

    const sigStructure = encodeSigStructure(cose.protectedBytes, cose.payload);
    if (!verifyEd25519Over(sigStructure, cose.signature, publicKeyPem)) {
      return {
        valid: false,
        error: `COSE statement ${i}: Ed25519 signature verification failed`,
        diagnostics: { format: 'p31-cose-sign1', framing, statement_count: frames.length, failed_statement: i, statements },
      };
    }

    let payloadJson: any = undefined;
    try { payloadJson = JSON.parse(cose.payload.toString('utf8')); } catch { /* non-JSON payload is allowed */ }
    statements.push({
      index: i,
      seq: payloadJson?.chain?.seq ?? null,
      tool: payloadJson?.action?.tool ?? null,
      alg,
      kid: kid instanceof Uint8Array ? Buffer.from(kid).toString('hex') : null,
      payload_bytes: cose.payload.length,
      payload_sha256: sha256Buffer(cose.payload),
      signature_bytes: cose.signature.length,
    });
  }

  return {
    valid: true,
    diagnostics: {
      format: 'p31-cose-sign1',
      framing,
      statement_count: statements.length,
      kid: expectedKid.toString('hex'),
      statements,
      verified: 'Ed25519 over RFC 9052 Sig_structure ["Signature1", protected, external_aad(empty), payload]',
      note: 'Adapter-level COSE_Sign1 packaging for SCITT-aligned drafts. Not SCITT registry/transparency-service registration.',
    },
  };
}

/** L5-H: verify a `.cose` file (P31 framing or a raw tag-18 COSE_Sign1). */
export function verifyCOSE(filePath: string, publicKeyPem: string): COSEVerifyResult {
  try {
    return verifyCOSEBuffer(readFileSync(filePath), publicKeyPem, filePath);
  } catch (e) {
    return { valid: false, error: `COSE read error (${filePath}): ${(e as Error).message}` };
  }
}

/** L5: Pre-execution Permit-style record (adapter targeting draft-munoz-scitt-permit-profile) */
export function exportPermit(filePath: string, decisions: Array<{request: any; decision: 'allow'|'block'|'elicit'; policyId: string; reason?: string; timestamp?: string}>): string {
  const generatedAt = new Date().toISOString();
  const permits = decisions.map((d, i) => {
    const canonicalReq = canonicalJson(d.request);
    const rec = { profile: 'p31-permit-adapter/v0.1', draft_target: 'draft-munoz-scitt-permit-profile', seq: i, timestamp: d.timestamp || generatedAt, policy_id: d.policyId, decision: d.decision, reason: d.reason || null, canonical_request_hash: sha256(canonicalReq), canonical_request: d.request };
    return { ...rec, signature: signData(sha256(canonicalJson(rec)), (()=>{const{privateKey}=ensureKeys();return privateKey;})()) };
  });
  const bundle = {
    format: 'p31-permit-adapter',
    version: '0.1',
    spec_version: 'p31-permit-adapter/v0.1',
    generated_by: '@p31ca/cli (guard-audit exportPermit)',
    generated_at: generatedAt,
    draft_target: 'draft-munoz-scitt-permit-profile',
    canonicalization: 'JCS-like via canonicalJson (recursive key sort, JSON.stringify); RFC 8785 intent. Signatures are Ed25519 over SHA-256(canonical permit record without signature).',
    public_key_pem: getPublicKey(),
    permits,
  };
  mkdirSync(dirname(filePath), { recursive: true });
  const content = JSON.stringify(bundle, null, 2);
  writeFileSync(filePath, content);
  console.log('Permit-adapter export:', filePath);
  console.log('Spec:', bundle.spec_version, '| decisions:', permits.length);
  return sha256(content);
}

/**
 * L7: resolve a session id from an audit entry.
 * Top-level `sessionId` (v2 field) is authoritative and checked first; the
 * remaining locations are legacy/best-effort fallbacks for older records.
 */
function entrySessionId(entry: any): string | undefined {
  const raw =
    entry?.sessionId ??            // v2 canonical field (checked first)
    entry?.session_id ??           // legacy snake_case
    entry?.context_provenance?.sessionId ??
    entry?.context_provenance?.session_id ??
    entry?.metadata?.sessionId ??
    entry?.metadata?.session_id;
  if (raw === undefined || raw === null || raw === '') return undefined;
  return String(raw);
}

/** L7: context lineage trace from audit log.
 * sessionId filtering prefers the canonical top-level `sessionId` field, then
 * legacy locations. `sessionFilterApplied` reports whether any entry in the
 * input actually carried session metadata (a session with zero matching
 * entries is still a valid, applied filter). staleDetected is computed when the
 * same sourceId appears with a different contentHash across consumptions (and
 * also honors freshness === 'STALE').
 */
export function traceContext(entries: GuardDecisionRecord[], sessionId?: string): { entries: any[]; summary: any } {
  const sessionFilterRequested = !!sessionId;
  const sessionFilterApplied = !!(sessionId && entries.some((e: any) => entrySessionId(e) !== undefined));
  const sessionFiltered = sessionId
    ? entries.filter((e: any) => {
        const sid = entrySessionId(e);
        return sid !== undefined && sid === String(sessionId);
      })
    : entries;
  const relevant = sessionFiltered.filter(e => e.context_provenance || e.model_provenance);
  const sources = new Map<string, any>();
  for (const e of relevant) {
    for (const s of e.context_provenance?.retrievedSources || []) {
      const prev = sources.get(s.sourceId);
      const contentChanged = !!(prev && prev.contentHash !== s.contentHash);
      sources.set(s.sourceId, {
        ...s,
        firstSeenSeq: prev?.firstSeenSeq ?? e.seq,
        lastSeenSeq: e.seq,
        staleDetected: contentChanged ? true : (prev?.staleDetected || s.freshness === 'STALE'),
        ...(contentChanged ? { previousContentHash: prev.contentHash } : {}),
      });
    }
  }
  return {
    entries: relevant.map(e=>({seq:e.seq,sessionId:entrySessionId(e),tool:e.tool,verdict:e.verdict,instructionHash:e.context_provenance?.instructionHash,bucket:e.model_provenance?.bucket,selectedModel:e.model_provenance?.selectedModel,sources:e.context_provenance?.retrievedSources||[]})),
    summary: {
      total: relevant.length,
      uniqueSources: sources.size,
      sources: [...sources.values()],
      ...(sessionFilterRequested ? {
        sessionId,
        sessionFilterApplied,
        sessionFilterLimitation: sessionFilterApplied
          ? undefined
          : 'No session metadata found on any entry; filter could not be applied (best-effort).',
      } : {}),
    }
  };
}

export function exportProvJSONLD(filePath: string, entries: GuardDecisionRecord[]): string {
  const { root: merkleRoot } = computeMerkleRoot(entries);
  const provDoc = {
    '@context': [
      'https://www.w3.org/ns/prov',
      {
        p31: 'https://p31ca.org/ns#',
        merkleRoot: 'p31:merkleRoot',
        entryCount: 'p31:entryCount',
      },
    ],
    '@id': 'p31:guard-audit-export',
    '@type': 'prov:Bundle',
    merkleRoot,
    entryCount: entries.length,
    exportedAt: new Date().toISOString(),
    'prov:entity': entries.map((entry) => ({
      '@id': `p31:entry-${entry.seq}`,
      '@type': 'prov:Entity',
      'prov:generatedAtTime': entry.timestamp,
      'p31:seq': entry.seq,
      'p31:version': entry.version || '1',
      'p31:tool': entry.tool,
      'p31:argsHash': entry.argsHash || '',
      'p31:guardVerdict': entry.guardVerdict || entry.verdict,
      'p31:policyId': entry.policyId || entry.policy_version,
      'p31:prevHash': entry.prev_hash,
      'p31:dataHash': entry.data_hash,
      'p31:signature': entry.signature,
      ...(entry.model_provenance ? { 'p31:modelProvenance': entry.model_provenance } : {}),
      ...(entry.context_provenance ? { 'p31:contextProvenance': entry.context_provenance } : {}),
    })),
  };

  mkdirSync(dirname(filePath), { recursive: true });
  const content = JSON.stringify(provDoc, null, 2);
  writeFileSync(filePath, content);
  const fileHash = sha256(content);
  console.log(`Merkle root: ${merkleRoot}`);
  console.log(`Export SHA-256: ${fileHash}`);
  console.log(`Exported to: ${filePath}`);
  return merkleRoot;
}

export function exportJSONL(filePath: string, entries: GuardDecisionRecord[]): string {
  mkdirSync(dirname(filePath), { recursive: true });
  const lines = entries.map(entry => JSON.stringify(entry)).join('\n') + (entries.length ? '\n' : '');
  writeFileSync(filePath, lines);
  const fileHash = sha256(lines);
  console.log(`JSONL export SHA-256: ${fileHash}`);
  console.log(`Exported to: ${filePath}`);
  return fileHash;
}

export function verifyProofFile(proofFile: string, publicKeyPem: string): { valid: boolean; error?: string; diagnostics?: any } {
  const raw = readFileSync(proofFile);

  // L5-H: binary COSE_Sign1 detection (extension, P31 framing marker, or raw tag 18).
  if (
    proofFile.toLowerCase().endsWith('.cose') ||
    looksLikeP31COSE(raw) ||
    (raw.length > 0 && raw[0] === 0xd2)
  ) {
    return verifyCOSEBuffer(raw, publicKeyPem, proofFile);
  }

  const content = raw.toString('utf-8').trim();
  let entries: GuardDecisionRecord[] = [];

  if (content.includes('"format":"p31-scitt-adapter"') || content.includes('"format": "p31-scitt-adapter"')) {
    try {
      const b = JSON.parse(content);
      const key = b.public_key_pem || publicKeyPem;
      const statements = b.statements || [];
      const diagnostics: any = {
        format: 'p31-scitt-adapter',
        spec_version: b.spec_version || b.version,
        generated_by: b.generated_by,
        draft_targets: b.draft_targets,
        canonicalization: b.canonicalization,
        statement_count: statements.length,
        merkle_root_claimed: b.merkle_root || null,
        verified: 'statement-signatures(ed25519 over payload_hash) with bundled/provided public key',
        note: 'Adapter-level verification: statement payload signatures checked. Full P31 hash-chain replay from original GuardDecisionRecord entries is available via JSONL/proof-chain inputs.',
      };
      if (!key) return { valid: false, error: 'SCITT-adapter: no public key available (bundle.public_key_pem missing and no --key provided)', diagnostics };
      for (const st of statements) {
        if (!st?.payload_hash || !st?.ed25519_signature_over_payload_hash) {
          return { valid: false, error: `SCITT-adapter: missing signature fields at seq ${st?.payload?.chain?.seq ?? '?'}`, diagnostics };
        }
        const ok = verifySignature(st.payload_hash, st.ed25519_signature_over_payload_hash, key);
        if (!ok) return { valid: false, error: `SCITT-adapter statement signature failed at seq ${st.payload?.chain?.seq ?? '?'}`, diagnostics };
      }
      return { valid: true, diagnostics };
    } catch (e) { return { valid: false, error: 'Failed to parse SCITT-adapter: '+(e as Error).message }; }
  }
  if (content.includes('"format":"p31-permit-adapter"') || content.includes('"format": "p31-permit-adapter"')) {
    try {
      const b = JSON.parse(content);
      const permits = b.permits || [];
      const diagnostics: any = {
        format: 'p31-permit-adapter',
        spec_version: b.spec_version || b.version,
        generated_by: b.generated_by,
        draft_target: b.draft_target,
        canonicalization: b.canonicalization,
        permit_count: permits.length,
        verified: 'ed25519 over sha256(canonical permit record without signature)',
      };
      const permitKey = b.public_key_pem || publicKeyPem;
      diagnostics.public_key_source = b.public_key_pem ? 'bundle' : 'provided';
      for (const p of permits) {
        const {signature, ...rest} = p;
        if (!signature) return { valid: false, error: `Permit: missing signature at seq ${p.seq ?? '?'}`, diagnostics };
        const ok = verifySignature(sha256(canonicalJson(rest)), signature, permitKey);
        if (!ok) return { valid: false, error: `Permit signature failed at seq ${p.seq ?? '?'}`, diagnostics };
      }
      return { valid: true, diagnostics };
    } catch (e) { return { valid: false, error: 'Failed to parse Permit-adapter: '+(e as Error).message }; }
  }
  if (content.includes('"@context"') || content.includes('"prov:entity"')) {
    try {
      const provDoc = JSON.parse(content);
      const entities = Array.isArray(provDoc['prov:entity']) ? provDoc['prov:entity'] : [];
      entries = entities.map((e: any) => ({
        id: String(e['@id'] || ''),
        seq: Number(e['p31:seq'] ?? 0),
        timestamp: e['prov:generatedAtTime'] || '',
        version: (e['p31:version'] === '2' ? '2' : '1') as '1' | '2',
        tool: e['p31:tool'] || '',
        argsHash: e['p31:argsHash'] || '',
        guardVerdict: e['p31:guardVerdict'] || 'allowed',
        policyId: e['p31:policyId'] || '',
        verdict: e['p31:guardVerdict'] || 'allowed',
        policy_version: e['p31:policyId'] || '',
        governed_state: { spoons: 0, crisis_flags: 0, fetched_at: e['prov:generatedAtTime'] || '' },
        model_provenance: e['p31:modelProvenance'],
        context_provenance: e['p31:contextProvenance'],
        prev_hash: e['p31:prevHash'] || '',
        data_hash: e['p31:dataHash'] || '',
        signature: e['p31:signature'] || '',
      }));
      // verify merkle if present
      const claimed = provDoc.merkleRoot;
      const diagnostics: any = {
        format: 'prov-jsonld',
        entry_count: entries.length,
        merkle_root_claimed: claimed || null,
        note: 'PROV reconstruction is lossy for hash-chain replay (original id/reason/governed_state values are not fully preserved in this export). Merkle is checked when present; full chain+signature verification is authoritative on JSONL/original records.',
      };
      if (claimed) {
        const { root } = computeMerkleRoot(entries);
        diagnostics.merkle_root_computed = root;
        if (root !== claimed) return { valid: false, error: `Merkle root mismatch: claimed ${claimed}, computed ${root}`, diagnostics };
      }
      const result = verifyGuardChain(entries, publicKeyPem);
      diagnostics.chain = result;
      if (!result.valid) return { valid: false, error: result.error, diagnostics };
      return { valid: true, diagnostics };
    } catch (e) {
      return { valid: false, error: `Failed to parse PROV-JSONLD: ${(e as Error).message}` };
    }
  } else {
    try {
      entries = content.split('\n').filter(Boolean).map(line => JSON.parse(line));
    } catch (e) {
      return { valid: false, error: `Failed to parse JSONL: ${(e as Error).message}` };
    }
  }

  const result = verifyGuardChain(entries, publicKeyPem);
  if (!result.valid) return { valid: false, error: result.error, diagnostics: { format: 'jsonl', entry_count: entries.length, chain: result } };
  return { valid: true, diagnostics: { format: 'jsonl', entry_count: entries.length, lastValidSeq: result.lastValidSeq } };
}
