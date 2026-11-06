/**
 * src/lib/deployment.ts — Sovereign deployment mode detection and policy helpers.
 *
 * P31_DEPLOYMENT_MODE=airgap|onprem|hybrid affects routing policy, theme/retention
 * defaults only. It MUST NOT affect provenance schema semantics or offline verification
 * (G6). When unset, behavior remains backward-compatible (no deployment restrictions).
 */

import { readFileSync, statSync } from 'node:fs';
import { basename, resolve as resolvePath } from 'node:path';

export type DeploymentMode = 'airgap' | 'onprem' | 'hybrid';

export type RoutingPolicySource = 'mode-default' | 'policy-file';

export interface DeploymentRoutingPolicy {
  /** Effective mode, or 'unset' for legacy/backward-compatible behavior. */
  mode: DeploymentMode | 'unset';
  /** Buckets that must resolve only to local providers. '*' means all buckets. */
  localOnlyBuckets: string[];
  /** In non-airgap modes, buckets allowed to use remote providers/fallbacks. '*' means all not in localOnlyBuckets. */
  allowedRemoteBuckets: string[];
  /** Optional allowlist of provider IDs (defense-in-depth). */
  allowedProviders?: string[];
  /** Human-readable policy id for audit/provenance context. */
  policyId: string;
  /** Where the effective policy came from. Absent on legacy callers; treated as 'mode-default'. */
  source?: RoutingPolicySource;
  /** Absolute path of the loaded policy file when source === 'policy-file'. */
  policyFile?: string;
}

/** Shape accepted from P31_ROUTING_POLICY_FILE (flat or under a `routing` object). */
export interface RoutingPolicyFile {
  policyId?: string;
  localOnlyBuckets: string[];
  allowedRemoteBuckets: string[];
  allowedProviders?: string[] | null;
}

export interface RoutingPolicyFileStatus {
  configured: boolean;
  loaded: boolean;
  path?: string;
  policyId?: string;
  error?: string;
}

const VALID_MODES = new Set<DeploymentMode>(['airgap', 'onprem', 'hybrid']);
const LOCAL_PROVIDER_IDS = new Set(['ollama', 'local', 'localhost', 'localai', 'vllm-local']);
const AIRGAP_DEFAULT_PROVIDERS = ['ollama', 'local', 'localhost', 'localai', 'vllm-local'];

export function getDeploymentMode(): DeploymentMode | undefined {
  const raw = process.env.P31_DEPLOYMENT_MODE?.trim().toLowerCase();
  if (raw && VALID_MODES.has(raw as DeploymentMode)) return raw as DeploymentMode;
  if (raw) {
    warnOnce(`mode:${raw}`, `[p31] WARN: P31_DEPLOYMENT_MODE='${raw}' is not one of airgap|onprem|hybrid; treating as unset (legacy behavior).`);
  }
  return undefined;
}

export function isAirgapMode(mode: DeploymentMode | undefined = getDeploymentMode()): boolean {
  return mode === 'airgap';
}

export function isOnpremMode(mode: DeploymentMode | undefined = getDeploymentMode()): boolean {
  return mode === 'onprem';
}

export function isHybridMode(mode: DeploymentMode | undefined = getDeploymentMode()): boolean {
  return mode === 'hybrid';
}

export function isLocalProvider(provider: string): boolean {
  const p = (provider || '').toLowerCase();
  if (LOCAL_PROVIDER_IDS.has(p)) return true;
  if (p.includes('ollama') || p.includes('localhost') || p.startsWith('local')) return true;
  return false;
}

export function isLocalSovereignBucket(bucket: string): boolean {
  return bucket === 'local-sovereign';
}

/* ------------------------------------------------------------------ */
/* P31_ROUTING_POLICY_FILE loading (L8-H.2)                           */
/* ------------------------------------------------------------------ */

const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  // Never throw from policy resolution; warnings are advisory and go to stderr.
  try {
    console.error(message);
  } catch {
    /* stderr unavailable (embedded host) — ignore */
  }
}

interface ParsedPolicyFile {
  policyId?: string;
  localOnlyBuckets: string[];
  allowedRemoteBuckets: string[];
  allowedProviders?: string[];
}

interface PolicyFileCacheEntry {
  stamp: string;
  data?: ParsedPolicyFile;
  error?: string;
}

const policyFileCache = new Map<string, PolicyFileCacheEntry>();

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string' && v.trim().length > 0);
}

/**
 * Validate a parsed policy-file object. Accepts either the flat shape
 * ({ localOnlyBuckets, allowedRemoteBuckets, allowedProviders }) or the
 * deploy/ example shape ({ routing: { ... } }). Unknown keys (deploymentMode,
 * theme, retention, $schemaNote, notes) are ignored: they must never affect
 * provenance schema or offline verification (G6).
 */
function validatePolicyFile(raw: unknown): { data?: ParsedPolicyFile; error?: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'root must be a JSON object' };
  }
  const root = raw as Record<string, unknown>;
  const candidate =
    root.routing && typeof root.routing === 'object' && !Array.isArray(root.routing)
      ? (root.routing as Record<string, unknown>)
      : root;

  if (!('localOnlyBuckets' in candidate)) return { error: 'missing required field: localOnlyBuckets (string[])' };
  if (!('allowedRemoteBuckets' in candidate)) return { error: 'missing required field: allowedRemoteBuckets (string[])' };
  if (!isStringArray(candidate.localOnlyBuckets)) return { error: 'localOnlyBuckets must be an array of non-empty strings' };
  if (!isStringArray(candidate.allowedRemoteBuckets)) return { error: 'allowedRemoteBuckets must be an array of non-empty strings' };

  let allowedProviders: string[] | undefined;
  if (candidate.allowedProviders !== undefined && candidate.allowedProviders !== null) {
    if (!isStringArray(candidate.allowedProviders)) {
      return { error: 'allowedProviders must be an array of non-empty strings or null' };
    }
    allowedProviders = [...candidate.allowedProviders];
  }

  const policyIdRaw = candidate.policyId ?? root.policyId;
  if (policyIdRaw !== undefined && policyIdRaw !== null && (typeof policyIdRaw !== 'string' || !policyIdRaw.trim())) {
    return { error: 'policyId must be a non-empty string when present' };
  }

  return {
    data: {
      ...(typeof policyIdRaw === 'string' ? { policyId: policyIdRaw.trim() } : {}),
      localOnlyBuckets: [...candidate.localOnlyBuckets],
      allowedRemoteBuckets: [...candidate.allowedRemoteBuckets],
      ...(allowedProviders ? { allowedProviders } : {}),
    },
  };
}

function loadParsedPolicyFile(filePath: string): PolicyFileCacheEntry {
  const absolute = resolvePath(filePath);
  let stamp: string;
  try {
    const st = statSync(absolute);
    stamp = `${st.mtimeMs}:${st.size}`;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const error = `cannot read file (${reason})`;
    warnOnce(`missing:${absolute}`, `[p31] WARN: P31_ROUTING_POLICY_FILE='${absolute}' ${error}; falling back to deployment-mode defaults.`);
    return { stamp: 'missing', error };
  }

  const cached = policyFileCache.get(absolute);
  if (cached && cached.stamp === stamp) return cached;

  let entry: PolicyFileCacheEntry;
  try {
    const text = readFileSync(absolute, 'utf-8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`invalid JSON (${reason})`);
    }
    const validation = validatePolicyFile(parsed);
    entry = validation.error ? { stamp, error: validation.error } : { stamp, data: validation.data };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    entry = { stamp, error: reason.startsWith('invalid JSON') ? reason : `cannot read file (${reason})` };
  }

  if (entry.error) {
    warnOnce(
      `invalid:${absolute}:${stamp}`,
      `[p31] WARN: P31_ROUTING_POLICY_FILE='${absolute}' is invalid: ${entry.error}; falling back to deployment-mode defaults.`,
    );
  }
  policyFileCache.set(absolute, entry);
  return entry;
}

/**
 * Load/validate P31_ROUTING_POLICY_FILE. Returns null when the env var is
 * unset or the file is missing/invalid (caller falls back to mode defaults).
 * Never throws.
 */
export function loadRoutingPolicyFile(
  filePath: string | undefined = process.env.P31_ROUTING_POLICY_FILE,
  mode: DeploymentMode | undefined = getDeploymentMode(),
): DeploymentRoutingPolicy | null {
  if (!filePath || !filePath.trim()) return null;
  const entry = loadParsedPolicyFile(filePath.trim());
  if (!entry.data) return null;
  const absolute = resolvePath(filePath.trim());
  return buildPolicyFromFile(entry.data, mode, absolute);
}

function buildPolicyFromFile(
  data: ParsedPolicyFile,
  mode: DeploymentMode | undefined,
  absolutePath: string,
): DeploymentRoutingPolicy {
  const filePolicyId = data.policyId || `policy-file:${basename(absolutePath)}`;
  if (mode === 'airgap') {
    // Airgap is a hard ceiling: a policy file may narrow, never widen, egress.
    const widened =
      !data.localOnlyBuckets.includes('*') ||
      data.allowedRemoteBuckets.length > 0 ||
      (data.allowedProviders?.some((p) => !isLocalProvider(p)) ?? false);
    if (widened) {
      warnOnce(
        `airgap-narrow:${absolutePath}`,
        `[p31] WARN: P31_ROUTING_POLICY_FILE='${absolutePath}' attempts to relax airgap local-only routing; airgap ceiling applied (all buckets local-only, no remote fallback).`,
      );
    }
    return {
      mode: 'airgap',
      localOnlyBuckets: ['*'],
      allowedRemoteBuckets: [],
      allowedProviders: data.allowedProviders
        ? data.allowedProviders.filter((p) => isLocalProvider(p))
        : [...AIRGAP_DEFAULT_PROVIDERS],
      policyId: filePolicyId,
      source: 'policy-file',
      policyFile: absolutePath,
    };
  }

  return {
    mode: mode ?? 'unset',
    localOnlyBuckets: [...data.localOnlyBuckets],
    allowedRemoteBuckets: [...data.allowedRemoteBuckets],
    allowedProviders: data.allowedProviders ? [...data.allowedProviders] : undefined,
    policyId: filePolicyId,
    source: 'policy-file',
    policyFile: absolutePath,
  };
}

/** Non-throwing status for diagnostics/evidence (does not change behavior). */
export function getRoutingPolicyFileStatus(): RoutingPolicyFileStatus {
  const configured = !!(process.env.P31_ROUTING_POLICY_FILE && process.env.P31_ROUTING_POLICY_FILE.trim());
  if (!configured) return { configured: false, loaded: false };
  const absolute = resolvePath(process.env.P31_ROUTING_POLICY_FILE!.trim());
  const entry = loadParsedPolicyFile(absolute);
  return {
    configured: true,
    loaded: !!entry.data,
    path: absolute,
    ...(entry.data?.policyId ? { policyId: entry.data.policyId } : {}),
    ...(entry.error ? { error: entry.error } : {}),
  };
}

/**
 * Default routing policy by deployment mode, overridden by
 * P31_ROUTING_POLICY_FILE when configured and valid.
 * G6: policy affects routing only, never provenance schema/offline verification.
 */
export function getDefaultRoutingPolicy(
  mode: DeploymentMode | undefined = getDeploymentMode(),
): DeploymentRoutingPolicy {
  const filePolicy = loadRoutingPolicyFile(undefined, mode);
  if (filePolicy) return filePolicy;
  if (mode === 'airgap') {
    return {
      mode: 'airgap',
      localOnlyBuckets: ['*'],
      allowedRemoteBuckets: [],
      allowedProviders: ['ollama', 'local', 'localhost', 'localai', 'vllm-local'],
      policyId: 'deploy:airgap:local-only-v1',
      source: 'mode-default',
    };
  }
  if (mode === 'onprem') {
    return {
      mode: 'onprem',
      localOnlyBuckets: ['local-sovereign'],
      allowedRemoteBuckets: ['*'],
      policyId: 'deploy:onprem:local-sovereign-local-v1',
      source: 'mode-default',
    };
  }
  if (mode === 'hybrid') {
    // Hybrid default: local-sovereign stays local; other buckets may use remote
    // fallback where allowed by policy. Explicit policy files may narrow this.
    return {
      mode: 'hybrid',
      localOnlyBuckets: ['local-sovereign'],
      allowedRemoteBuckets: ['*'],
      policyId: 'deploy:hybrid:local-sovereign-first-v1',
      source: 'mode-default',
    };
  }
  return {
    mode: 'unset',
    localOnlyBuckets: [],
    allowedRemoteBuckets: ['*'],
    policyId: 'deploy:unset:legacy-v1',
    source: 'mode-default',
  };
}

export function bucketMustBeLocal(bucket: string, policy = getDefaultRoutingPolicy()): boolean {
  return policy.localOnlyBuckets.includes('*') || policy.localOnlyBuckets.includes(bucket);
}

export function bucketAllowsRemote(bucket: string, policy = getDefaultRoutingPolicy()): boolean {
  if (bucketMustBeLocal(bucket, policy)) return false;
  return policy.allowedRemoteBuckets.includes('*') || policy.allowedRemoteBuckets.includes(bucket);
}

export function providerAllowed(provider: string, policy = getDefaultRoutingPolicy()): boolean {
  if (policy.allowedProviders && policy.allowedProviders.length > 0) {
    const p = (provider || '').toLowerCase();
    return policy.allowedProviders.some(ap => p === ap || p.includes(ap));
  }
  if (bucketMustBeLocal('*', policy)) return isLocalProvider(provider);
  return true;
}

/**
 * Maps deployment mode to theme environment signal (L8.4).
 * airgap/onprem imply regulated signaling; hybrid/unset leave env choice to caller.
 */
export function getDeploymentThemeEnv(
  mode: DeploymentMode | undefined = getDeploymentMode(),
): 'regulated' | undefined {
  if (mode === 'airgap' || mode === 'onprem') return 'regulated';
  return undefined;
}

export interface DeploymentSummary {
  detectedMode: DeploymentMode | 'unset';
  envValue: string | undefined;
  routingPolicy: DeploymentRoutingPolicy;
  themeEnvDefault: 'regulated' | undefined;
  provenanceContract: 'unchanged (G6)';
  offlineVerification: 'unchanged (G6)';
  policySource: RoutingPolicySource;
  policyFileStatus: RoutingPolicyFileStatus;
  timestamp: string;
}

export function getDeploymentSummary(mode: DeploymentMode | undefined = getDeploymentMode()): DeploymentSummary {
  const policy = getDefaultRoutingPolicy(mode);
  return {
    detectedMode: mode ?? 'unset',
    envValue: process.env.P31_DEPLOYMENT_MODE,
    routingPolicy: policy,
    themeEnvDefault: getDeploymentThemeEnv(mode),
    provenanceContract: 'unchanged (G6)',
    offlineVerification: 'unchanged (G6)',
    policySource: policy.source ?? 'mode-default',
    policyFileStatus: getRoutingPolicyFileStatus(),
    timestamp: new Date().toISOString(),
  };
}

export function formatDeploymentSummary(summary = getDeploymentSummary()): string {
  return [
    `P31_DEPLOYMENT_MODE=${summary.envValue ?? '(unset)'}`,
    `detectedMode=${summary.detectedMode}`,
    `policyId=${summary.routingPolicy.policyId}`,
    `policySource=${summary.policySource}`,
    `policyFile=${summary.routingPolicy.policyFile ?? '(none)'}`,
    `policyFileStatus=${summary.policyFileStatus.loaded ? 'loaded' : summary.policyFileStatus.configured ? `fallback (${summary.policyFileStatus.error ?? 'invalid'})` : 'not configured'}`,
    `localOnlyBuckets=${JSON.stringify(summary.routingPolicy.localOnlyBuckets)}`,
    `allowedRemoteBuckets=${JSON.stringify(summary.routingPolicy.allowedRemoteBuckets)}`,
    `allowedProviders=${JSON.stringify(summary.routingPolicy.allowedProviders ?? null)}`,
    `themeEnvDefault=${summary.themeEnvDefault ?? '(none)'}`,
    `provenanceContract=${summary.provenanceContract}`,
    `offlineVerification=${summary.offlineVerification}`,
    `timestamp=${summary.timestamp}`,
  ].join('\n');
}
