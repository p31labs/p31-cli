/**
 * src/routing/health-probe.test.ts — Tests for the nightly health probe.
 *
 * Tests:
 *   • Health probe excludes degraded models
 *   • Reports healthy/degraded counts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runHealthProbe } from '../../src/routing/health-probe.js';
import { CapabilityRouter, ProviderPool } from '../../src/routing/index.js';

function mockFetch(ok: boolean, toolCalls: boolean): void {
  const mockFn = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 429,
    text: vi.fn().mockResolvedValue(''),
    json: vi.fn().mockResolvedValue({
      choices: toolCalls ? [{ message: { tool_calls: [{ name: 'echo', arguments: { value: 'test' } }] } }] : [{ message: {} }],
    }),
  });
  vi.stubGlobal('fetch', mockFn);
}

describe('runHealthProbe', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('marks free models healthy when tool-calling succeeds', async () => {
    mockFetch(true, true);
    const pool = new ProviderPool();
    pool.register({ model: 'openrouter/model-a', provider: 'openrouter', costTier: 'free', capabilities: new Set(['fast-code']) });
    pool.register({ model: 'openrouter/model-b', provider: 'openrouter', costTier: 'free', capabilities: new Set(['summarize']) });
    const router = new CapabilityRouter(pool);

    const report = await runHealthProbe(router, '/tmp/opencode/health-test-report.json');

    expect(report.totalModels).toBe(2);
    expect(report.healthy).toBe(2);
    expect(report.degraded).toBe(0);
  });

  it('marks models degraded when tool-calling fails', async () => {
    mockFetch(false, false);
    const pool = new ProviderPool();
    pool.register({ model: 'openrouter/model-c', provider: 'openrouter', costTier: 'free', capabilities: new Set(['fast-code']) });
    const router = new CapabilityRouter(pool);

    const report = await runHealthProbe(router, '/tmp/opencode/health-test-report.json');

    expect(report.degraded).toBe(1);
    expect(report.results[0].ok).toBe(false);
  });

  it('writes health-report.json', async () => {
    mockFetch(true, true);
    const pool = new ProviderPool();
    pool.register({ model: 'openrouter/model-x', provider: 'openrouter', costTier: 'free', capabilities: new Set(['vision']) });
    const router = new CapabilityRouter(pool);

    const outPath = '/tmp/opencode/health-test-write.json';
    const report = await runHealthProbe(router, outPath);

    const fs = await import('fs');
    const written = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    expect(written.generatedAt).toBeDefined();
    expect(written.totalModels).toBe(1);
    expect(written.healthy).toBe(1);
  });
});