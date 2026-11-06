/**
 * tests/routing/policy-file.test.ts — L8-H.2/L8-H.3 policy-file loading + hybrid enforcement.
 *
 * Covers:
 *   • valid flat and nested (`routing`) policy files load and override mode defaults
 *   • missing/invalid files warn on stderr and fall back to mode defaults (never throw)
 *   • hybrid policy narrowing allowedRemoteBuckets restricts router candidates
 *   • allowedProviders allowlist restricts router candidates
 *   • airgap cannot be widened by a policy file
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CapabilityRouter } from '../../src/routing/index.js';
import {
  getDefaultRoutingPolicy,
  getRoutingPolicyFileStatus,
  loadRoutingPolicyFile,
} from '../../src/lib/deployment.js';
import type { CapabilityBucket } from '../../src/routing/index.js';

let dir: string;
let seq = 0;

function policyPath(name = 'policy.json'): string {
  return join(dir, `${seq++}-${name}`);
}

function writePolicy(name: string, contents: unknown): string {
  const p = policyPath(name);
  writeFileSync(p, typeof contents === 'string' ? contents : JSON.stringify(contents, null, 2));
  return p;
}

function request(bucket: CapabilityBucket) {
  return { bucket, sessionId: 'policy-test', agentId: 'policy-test-agent' };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'p31-policy-'));
  delete process.env.P31_DEPLOYMENT_MODE;
  delete process.env.P31_ROUTING_POLICY_FILE;
});

afterEach(() => {
  delete process.env.P31_DEPLOYMENT_MODE;
  delete process.env.P31_ROUTING_POLICY_FILE;
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('P31_ROUTING_POLICY_FILE loading', () => {
  it('loads a flat valid policy file', () => {
    const file = writePolicy('flat.json', {
      policyId: 'test:flat:v1',
      localOnlyBuckets: ['local-sovereign'],
      allowedRemoteBuckets: ['fast-code', 'summarize'],
      allowedProviders: ['ollama', 'openrouter'],
    });
    process.env.P31_ROUTING_POLICY_FILE = file;
    process.env.P31_DEPLOYMENT_MODE = 'hybrid';

    const policy = getDefaultRoutingPolicy();
    expect(policy.policyId).toBe('test:flat:v1');
    expect(policy.localOnlyBuckets).toEqual(['local-sovereign']);
    expect(policy.allowedRemoteBuckets).toEqual(['fast-code', 'summarize']);
    expect(policy.allowedProviders).toEqual(['ollama', 'openrouter']);
    expect(policy.source).toBe('policy-file');
    expect(policy.policyFile).toBe(file);
    expect(getRoutingPolicyFileStatus()).toMatchObject({ configured: true, loaded: true, policyId: 'test:flat:v1' });
  });

  it('loads the deploy/ nested routing shape', () => {
    const file = writePolicy('nested.json', {
      deploymentMode: 'hybrid',
      routing: {
        localOnlyBuckets: ['local-sovereign'],
        allowedRemoteBuckets: ['fast-code'],
        allowedProviders: null,
      },
      theme: { defaultEnvironmentSignal: null },
    });
    process.env.P31_ROUTING_POLICY_FILE = file;
    process.env.P31_DEPLOYMENT_MODE = 'hybrid';

    const policy = loadRoutingPolicyFile();
    expect(policy).not.toBeNull();
    expect(policy!.allowedRemoteBuckets).toEqual(['fast-code']);
    expect(policy!.allowedProviders).toBeUndefined();
    expect(policy!.policyId).toMatch(/^policy-file:.*nested\.json$/);
  });

  it('falls back to mode defaults on invalid JSON and warns once per path/version', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const file = writePolicy('broken.json', '{ not json');
    process.env.P31_ROUTING_POLICY_FILE = file;
    process.env.P31_DEPLOYMENT_MODE = 'hybrid';

    const a = getDefaultRoutingPolicy();
    const b = getDefaultRoutingPolicy();
    expect(a.policyId).toBe('deploy:hybrid:local-sovereign-first-v1');
    expect(b.policyId).toBe(a.policyId);
    expect(a.source ?? 'mode-default').toBe('mode-default');
    expect(err).toHaveBeenCalledTimes(1);
    expect(err.mock.calls[0][0]).toContain('is invalid: invalid JSON');
    expect(err.mock.calls[0][0]).toContain('falling back to deployment-mode defaults');
    expect(getRoutingPolicyFileStatus()).toMatchObject({ configured: true, loaded: false });
  });

  it('falls back to mode defaults when the file is missing', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.P31_ROUTING_POLICY_FILE = join(dir, 'does-not-exist.json');
    process.env.P31_DEPLOYMENT_MODE = 'onprem';

    const policy = getDefaultRoutingPolicy();
    expect(policy.policyId).toBe('deploy:onprem:local-sovereign-local-v1');
    expect(err).toHaveBeenCalledTimes(1);
    expect(err.mock.calls[0][0]).toContain('cannot read file');
    expect(err.mock.calls[0][0]).toContain('falling back to deployment-mode defaults');
  });

  it('rejects a policy file with the wrong shape and warns', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const file = writePolicy('shape.json', { localOnlyBuckets: ['local-sovereign'] });
    process.env.P31_ROUTING_POLICY_FILE = file;
    process.env.P31_DEPLOYMENT_MODE = 'unset-mode-invalid';

    // Invalid mode is treated as unset/legacy.
    const policy = getDefaultRoutingPolicy();
    expect(policy.policyId).toBe('deploy:unset:legacy-v1');
    expect(err.mock.calls.some((c) => String(c[0]).includes('missing required field: allowedRemoteBuckets'))).toBe(true);
  });
});

describe('Hybrid policy enforcement (L8-H.3)', () => {
  it('narrows allowedRemoteBuckets: vision is blocked while fast-code routes remote', () => {
    const file = writePolicy('hybrid-narrow.json', {
      policyId: 'test:hybrid:narrow-v1',
      localOnlyBuckets: ['local-sovereign'],
      allowedRemoteBuckets: ['fast-code', 'deep-reasoning', 'structured-json', 'summarize'],
    });
    process.env.P31_ROUTING_POLICY_FILE = file;
    process.env.P31_DEPLOYMENT_MODE = 'hybrid';

    const router = new CapabilityRouter();
    expect(router.resolveCandidates(request('vision'))).toEqual([]);
    expect(router.resolveCandidates(request('fast-code')).length).toBeGreaterThan(0);
    expect(router.resolveCandidates(request('local-sovereign')).every((c) => c.entry.provider === 'ollama')).toBe(true);
  });

  it('throws a clear RoutingError naming the policy file for a restricted bucket', async () => {
    const file = writePolicy('hybrid-vision.json', {
      policyId: 'test:hybrid:no-vision-v1',
      localOnlyBuckets: ['local-sovereign'],
      allowedRemoteBuckets: ['fast-code'],
    });
    process.env.P31_ROUTING_POLICY_FILE = file;
    process.env.P31_DEPLOYMENT_MODE = 'hybrid';

    const router = new CapabilityRouter();
    await expect(router.route(request('vision'))).rejects.toMatchObject({
      name: 'RoutingError',
      message: expect.stringContaining('blocked all candidates'),
    });
    await expect(router.route(request('vision'))).rejects.toMatchObject({
      message: expect.stringContaining('test:hybrid:no-vision-v1'),
    });

    const lastDecision = router.getLog().entries().at(-1);
    expect(lastDecision?.candidatesConsidered).toEqual([]);
    expect(lastDecision?.selectedModel).toBe('(none)');
  });

  it('restricts candidates via allowedProviders', () => {
    const file = writePolicy('providers.json', {
      policyId: 'test:providers:v1',
      localOnlyBuckets: ['local-sovereign'],
      allowedRemoteBuckets: ['*'],
      allowedProviders: ['ollama'],
    });
    process.env.P31_ROUTING_POLICY_FILE = file;
    process.env.P31_DEPLOYMENT_MODE = 'hybrid';

    const router = new CapabilityRouter();
    expect(router.resolveCandidates(request('fast-code'))).toEqual([]);
    expect(router.resolveCandidates(request('vision'))).toEqual([]);
    expect(router.resolveCandidates(request('local-sovereign')).length).toBe(3);
  });

  it('applies a policy file even when P31_DEPLOYMENT_MODE is unset', () => {
    const file = writePolicy('unset.json', {
      policyId: 'test:unset:local-only-v1',
      localOnlyBuckets: ['*'],
      allowedRemoteBuckets: [],
    });
    process.env.P31_ROUTING_POLICY_FILE = file;

    const router = new CapabilityRouter();
    expect(router.resolveCandidates(request('fast-code'))).toEqual([]);
    expect(router.resolveCandidates(request('local-sovereign')).length).toBe(3);
    expect(getDefaultRoutingPolicy().source).toBe('policy-file');
  });

  it('does not let a policy file widen airgap egress', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const file = writePolicy('airgap-widen.json', {
      policyId: 'test:airgap:widen-v1',
      localOnlyBuckets: ['local-sovereign'],
      allowedRemoteBuckets: ['*'],
      allowedProviders: ['ollama', 'openrouter'],
    });
    process.env.P31_ROUTING_POLICY_FILE = file;
    process.env.P31_DEPLOYMENT_MODE = 'airgap';

    const policy = getDefaultRoutingPolicy();
    expect(policy.localOnlyBuckets).toEqual(['*']);
    expect(policy.allowedRemoteBuckets).toEqual([]);
    expect(policy.allowedProviders).toEqual(['ollama']);
    expect(err.mock.calls.some((c) => String(c[0]).includes('attempts to relax airgap'))).toBe(true);

    const router = new CapabilityRouter();
    expect(router.resolveCandidates(request('fast-code'))).toEqual([]);
    expect(router.resolveCandidates(request('local-sovereign')).every((c) => c.entry.provider === 'ollama')).toBe(true);
  });
});

describe('Policy resolution never throws at import/resolve time', () => {
  it('handles an unreadable directory path', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.P31_ROUTING_POLICY_FILE = dir; // a directory, not a file
    expect(() => getDefaultRoutingPolicy()).not.toThrow();
    expect(getDefaultRoutingPolicy().policyId).toBe('deploy:unset:legacy-v1');
  });

  it('reports unconfigured status cleanly', () => {
    expect(getRoutingPolicyFileStatus()).toEqual({ configured: false, loaded: false });
  });
});
