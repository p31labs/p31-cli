#!/usr/bin/env node
/**
 * L9 demo (Wave 3): capability bucket routing with 429 failover.
 * Mock adapter fails the primary fast-code candidate once with a 429; the
 * CapabilityRouter must apply cooldown + fall back to the next candidate.
 */
import { CapabilityRouter, type RouteRequest } from '../src/routing/index.js';
import { CooldownManager } from '../src/routing/cooldown.js';

const attempts = new Map<string, number>();
const adapterFactory = (model: string, provider: string) => ({
  chat: async (p: any) => {
    const key = `${provider}/${model}`;
    const n = attempts.get(key) ?? 0;
    attempts.set(key, n + 1);
    const primaryFailed = key.startsWith('openrouter/openrouter/deepseek/deepseek-v4-flash');
    if (primaryFailed && n === 0) {
      const e = new Error(`429 Too Many Requests (mock) via ${provider}`) as any;
      e.statusCode = 429;
      throw e;
    }
    return {
      content: 'mock-ok',
      model,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      stopReason: 'end_turn',
    } as any;
  },
});

const router = new CapabilityRouter(undefined, new CooldownManager(), undefined, adapterFactory);
const request: RouteRequest = {
  bucket: 'fast-code',
  constraints: { maxLatencyMs: 2000, requireToolCalling: true, minContextWindow: 128000 },
  sessionId: 'demo-l9-90s',
  agentId: 'build',
};

try {
  const d = await router.route(request);
  console.log(JSON.stringify(d, null, 2));
} catch (e: any) {
  console.log(JSON.stringify(e.decision, null, 2));
}
