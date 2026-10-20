/**
 * Guard Audit — Signed, hash-chained guard decision records
 *
 * Implements tamper-evident audit logging following the nexuscone/chainproof pattern:
 * - SHA-256 hash chain with Ed25519 signatures per entry
 * - Genesis anchor: 64 zeros
 * - UUIDv7 ids, monotonic seq, canonical JSON serialization
 * - Append-only JSONL log at ~/.p31/guard-audit.jsonl
 */

import { createHash, generateKeyPairSync, randomUUID, createPrivateKey, createPublicKey, sign as cryptoSign, verify as cryptoVerify } from 'node:crypto';
import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const AUDIT_DIR = join(homedir(), '.p31');
function getAuditFile(): string { return process.env.GUARD_AUDIT_FILE || join(AUDIT_DIR, "guard-audit.jsonl"); }
const GENESIS_HASH = createHash('sha256').update('chainproof:genesis').digest('hex');

export interface GuardDecisionRecord {
  id: string;
  seq: number;
  timestamp: string;
  tool: string;
  policy_version: string;
  governed_state: {
    spoons: number;
    crisis_flags: number;
    fetched_at: string;
  };
  verdict: 'allowed' | 'blocked' | 'elicitation_required';
  reason?: string;
  prev_hash: string;
  data_hash: string;
  signature: string;
}

// Ed25519 key pair for signing (reuse sovereign identity if available)
let _privateKey: string | null = null;
let _publicKey: string | null = null;

function ensureKeys(): { privateKey: string; publicKey: string } {
  if (_privateKey && _publicKey) return { privateKey: _privateKey, publicKey: _publicKey };

  // Try to load from env or file
  const keyPath = join(AUDIT_DIR, 'guard-key.pem');
  if (existsSync(keyPath)) {
    _privateKey = readFileSync(keyPath, 'utf-8');
    const pubPath = join(AUDIT_DIR, 'guard-pub.pem');
    _publicKey = existsSync(pubPath) ? readFileSync(pubPath, 'utf-8') : '';
    if (_publicKey) return { privateKey: _privateKey, publicKey: _publicKey };
  }

  // Generate new key pair
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  _privateKey = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  _publicKey = publicKey.export({ type: 'spki', format: 'pem' }) as string;

  mkdirSync(AUDIT_DIR, { recursive: true });
  appendFileSync(keyPath, _privateKey);
  appendFileSync(join(AUDIT_DIR, 'guard-pub.pem'), _publicKey);

  return { privateKey: _privateKey, publicKey: _publicKey };
}

function canonicalJson(obj: any): string {
  // Sort keys recursively, exclude signature field
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
  reason?: string
): GuardDecisionRecord {
  const { privateKey, publicKey } = ensureKeys();
  const now = new Date().toISOString();

  const record: Omit<GuardDecisionRecord, 'prev_hash' | 'data_hash' | 'signature'> = {
    id: randomUUID(),
    seq: getNextSeq(),
    timestamp: now,
    tool,
    policy_version: policyVersion,
    governed_state: {
      spoons: governedState.spoons,
      crisis_flags: governedState.crisis_flags,
      fetched_at: now,
    },
    verdict,
    reason,
  };

  const prevHash = getPrevHash();
  const canonical = canonicalJson({ ...record, prev_hash: prevHash });
  const dataHash = sha256(canonical);
  const signature = signData(dataHash, privateKey);

  const fullRecord: GuardDecisionRecord = {
    ...record,
    prev_hash: prevHash,
    data_hash: dataHash,
    signature,
  };

  mkdirSync(AUDIT_DIR, { recursive: true });
  appendFileSync(getAuditFile(), JSON.stringify(fullRecord) + '\n');

  return fullRecord;
}

export function verifyGuardChain(
  entries: GuardDecisionRecord[],
  publicKeyPem: string
): { valid: boolean; lastValidSeq: number; error?: string } {
  let prevHash = GENESIS_HASH;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Check prev_hash linkage
    if (entry.prev_hash !== prevHash) {
      return { valid: false, lastValidSeq: i > 0 ? entries[i - 1].seq : -1, error: `Chain break at seq ${entry.seq}: prev_hash mismatch` };
    }

    // Recompute data_hash
    const { prev_hash, data_hash, signature, ...rest } = entry;
    const canonical = canonicalJson({ ...rest, prev_hash });
    const recomputedHash = sha256(canonical);

    if (recomputedHash !== data_hash) {
      return { valid: false, lastValidSeq: i > 0 ? entries[i - 1].seq : -1, error: `Hash mismatch at seq ${entry.seq}` };
    }

    // Verify signature
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
