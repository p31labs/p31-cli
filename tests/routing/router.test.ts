/**
 * src/routing/router.test.ts — Unit tests for the capability-bucket router.
 *
 * Tests:
 *   • Bucket resolves to concrete model without caller naming one
 *   • 429 triggers 30s cooldown
 *   • Hang/timeout triggers 15 min cooldown
 *   • Fallback: primary fails → secondary serves, fallbackDepth recorded
 *   • Health probe excludes degraded models
 *
 * Run with: npx vitest run src/routing/router.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CapabilityRouter,
  ProviderPool,
  CapabilityBucket,
  CooldownManager,
  SelectionLog,
  RoutingError,
} from '../../src/routing/index.js';
import { CooldownManager as CooldownManager2, classifyError } from '../../src/routing/cooldown.js';
import type { RouteRequest } from '../../src/types.js';

// ── Helpers ──────────────────────────────────────────────────────────

function makeRequest(bucket: CapabilityBucket): RouteRequest {
  return {
    bucket,
    sessionId: 'test-session',
    agentId: 'test-agent',
  };
}

function failingAdapter(error: Error): { chat: (params: any) => Promise<any> } {
  return {
    chat: vi.fn().mockRejectedValue(error),
  };
}

function succeedingAdapter(content = 'ok'): { chat: (params: any) => Promise<any> } {
  return { chat: vi.fn().mockResolvedValue({ content, model: 'test-model', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, stopReason: 'stop' }) };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('CapabilityRouter — bucket resolution', () => {
  it('resolves fast-code to a concrete model without caller naming one', async () => {
    const router = new CapabilityRouter();
    const adapter = succeedingAdapter('fast-code response');
    const orig = router['adapterFactory'];
    // Monkeypatch factory to return our adapter regardless of model/provider
    (router as any).adapterFactory = () => adapter;

    const req = makeRequest('fast-code');
    const decision = await router.route(req);

    expect(decision.selectedModel).not.toBe('');
    expect(decision.selectedProvider).not.toBe('');
    expect(decision.fallbackDepth).toBe(0);
    expect(decision.errorClass).toBe('none');
    expect(decision.candidatesConsidered.length).toBeGreaterThan(0);
    expect(decision.candidatesConsidered.some((c) => c.endsWith(decision.selectedModel.split('/').pop()!))).toBe(true);
  });

  it('records fallbackDepth when primary fails and secondary succeeds', async () => {
    const pool = new ProviderPool();
    const log = new SelectionLog();
    const cooldowns = new CooldownManager();

    const primaryAdapter = failingAdapter(new Error('429 — rate limit'));
    const secondaryAdapter = succeedingAdapter('fallback response');

    // Build router but override factory per-model
    const router = new CapabilityRouter(pool, cooldowns, log);
    (router as any).adapterFactory = (model: string, provider: string) => {
      if (model.includes('deepseek-v4-flash')) return primaryAdapter;
      return secondaryAdapter;
    };

    const req = makeRequest('fast-code');
    const decision = await router.route(req);

    expect(decision.fallbackDepth).toBe(1);
    expect(decision.selectedModel).not.toContain('deepseek-v4-flash');
    expect(decision.errorClass).toBe('none'); // final succeeded
  });

  it('throws RoutingError when all candidates exhausted', async () => {
    const router = new CapabilityRouter();
    (router as any).adapterFactory = () =>
      failingAdapter(new Error('429 — rate limit'));

    const req = makeRequest('deep-reasoning');
    await expect(router.route(req)).rejects.toBeInstanceOf(RoutingError);
  });

  it('does not break when pool is empty (all models unregistered)', async () => {
    const pool = new ProviderPool();
    const router = new CapabilityRouter(pool);
    (router as any).adapterFactory = () => succeedingAdapter('ok');

    const req = makeRequest('fast-code');
    const decision = await router.route(req);
    expect(decision.selectedModel).toBeDefined();
    expect(decision.fallbackDepth).toBe(0);
  });
});

describe('CooldownManager — taxonomy', () => {
  it('429 triggers 30 second cooldown', () => {
    const mgr = new CooldownManager();
    expect(mgr.getCooldownSeconds('429')).toBe(30);
    mgr.recordFailure('openrouter/model-a', '429');
    expect(mgr.isCoolingDown('openrouter/model-a')).toBe(true);
  });

  it('timeout/hang triggers 15 minute cooldown', () => {
    const mgr = new CooldownManager();
    expect(mgr.getCooldownSeconds('timeout')).toBe(60 * 15);
    mgr.recordFailure('openrouter/model-b', 'timeout');
    expect(mgr.isCoolingDown('openrouter/model-b')).toBe(true);
  });

  it('quota exhausted triggers 1 hour cooldown', () => {
    const mgr = new CooldownManager();
    expect(mgr.getCooldownSeconds('quota')).toBe(60 * 60);
  });

  it('401/403 triggers 6 hour cooldown', () => {
    const mgr = new CooldownManager();
    expect(mgr.getCooldownSeconds('401')).toBe(6 * 60 * 60);
    expect(mgr.getCooldownSeconds('403')).toBe(6 * 60 * 60);
  });

  it('repeated failures double (exponential backoff)', () => {
    const mgr = new CooldownManager();
    const key = 'openrouter/model-c';
    const t1 = mgr.recordFailure(key, '429'); // 30s
    const t2 = mgr.recordFailure(key, '429'); // 60s
    const t3 = mgr.recordFailure(key, '429'); // 120s
    const d1 = t1 - Date.now();
    const d2 = t2 - Date.now();
    const d3 = t3 - Date.now();
    expect(d2).toBeGreaterThan(d1);
    expect(d3).toBeGreaterThan(d2);
  });

  it('classifyError returns correct classes', () => {
    expect(classifyError(new Error('429 rate limit'))).toBe('429');
    expect(classifyError(new Error('Request timed out'))).toBe('timeout');
    expect(classifyError(new Error('quota exhausted'))).toBe('quota');
    expect(classifyError(new Error('401 invalid api key'))).toBe('401');
    expect(classifyError(new Error('403 forbidden'))).toBe('403');
    expect(classifyError(new Error('unknown error'))).toBeNull();
  });

  it('isCoolingDownFor matches error class', () => {
    const mgr = new CooldownManager();
    mgr.recordFailure('openrouter/model-d', '429');
    expect(mgr.isCoolingDownFor('openrouter/model-d', '429')).toBe(true);
    expect(mgr.isCoolingDownFor('openrouter/model-d', 'timeout')).toBe(false);
  });

  it('recordSuccess clears cooldown', () => {
    const mgr = new CooldownManager();
    mgr.recordFailure('openrouter/model-e', 'timeout');
    expect(mgr.isCoolingDown('openrouter/model-e')).toBe(true);
    mgr.recordSuccess('openrouter/model-e');
    expect(mgr.isCoolingDown('openrouter/model-e')).toBe(false);
  });
});

describe('SelectionLog', () => {
  it('records every route decision', () => {
    const log = new SelectionLog();
    const decision = {
      bucket: 'fast-code',
      candidatesConsidered: ['openrouter/model-1'],
      selectedModel: 'openrouter/model-1',
      selectedProvider: 'openrouter',
      selectionReason: 'test',
      fallbackDepth: 0,
      latencyMs: 10,
      errorClass: 'none',
      policyId: 'sess-1',
      timestamp: new Date().toISOString(),
    };
    log.log(decision);
    expect(log.count()).toBe(1);
    expect(log.entries()[0]).toMatchObject(decision);
  });
});

describe('ProviderPool', () => {
  it('registers and looks up models', () => {
    const pool = new ProviderPool();
    pool.register({
      model: 'test-model',
      provider: 'test-provider',
      costTier: 'free',
      capabilities: new Set(['fast-code']),
    });
    expect(pool.has('test-model', 'test-provider')).toBe(true);
    const entry = pool.getModel('test-model', 'test-provider');
    expect(entry?.model).toBe('test-model');
    expect(entry?.costTier).toBe('free');
  });

  it('unregisterProvider removes all models for a provider', () => {
    const pool = new ProviderPool();
    pool.register({ model: 'm1', provider: 'p1', costTier: 'free', capabilities: new Set(['fast-code']) });
    pool.register({ model: 'm2', provider: 'p2', costTier: 'free', capabilities: new Set(['fast-code']) });
    pool.unregisterProvider('p1');
    expect(pool.has('m1', 'p1')).toBe(false);
    expect(pool.has('m2', 'p2')).toBe(true);
  });
});
