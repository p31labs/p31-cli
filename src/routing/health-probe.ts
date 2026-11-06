/**
 * src/routing/health-probe.ts — Nightly CI health probe for the capability router.
 *
 * Tests tool-calling capability on each free model in the pool, marks degraded
 * models, and writes health-report.json. Designed to run once per night via CI.
 */

import { CapabilityRouter, ProviderPool, CapabilityBucket, CostTier } from './index.js';
import type { ModelEntry, HealthState } from './index.js';
import fs from 'fs';
import { join } from 'path';

export interface ProbeResult {
  model: string;
  provider: string;
  costTier: CostTier;
  capabilities: CapabilityBucket[];
  ok: boolean;
  error?: string;
  testedAt: string;
  health: HealthState;
}

export interface HealthReport {
  generatedAt: string;
  totalModels: number;
  healthy: number;
  degraded: number;
  results: ProbeResult[];
}

const PROBE_TEST_INSTRUCTION = JSON.stringify({
  role: 'user',
  content: 'Respond with JSON: {"tool_calls":[{"name":"echo","arguments":{"value":"test"}}]} using tool calling',
});

export async function runHealthProbe(
  router: CapabilityRouter,
  outputPath: string = join(process.cwd(), 'health-report.json'),
): Promise<HealthReport> {
  const pool: ProviderPool = router.getPool();
  const entries = pool.allEntries();
  const results: ProbeResult[] = [];

  for (const entry of entries) {
    const isFree = entry.costTier === 'free';
    let ok = false;
    let error: string | undefined;
    let testedAt = new Date().toISOString();

    try {
      const probeResult = await probeModel(entry.model, entry.provider);
      ok = probeResult;
      error = probeResult ? undefined : 'Model did not produce tool-call output';
    } catch (e) {
      ok = false;
      error = (e as Error).message;
    }

    const now = Date.now();
    results.push({
      model: entry.model,
      provider: entry.provider,
      costTier: entry.costTier,
      capabilities: Array.from(entry.capabilities),
      ok,
      error,
      testedAt,
      health: {
        lastCheckMs: now,
        failures: ok ? 0 : 1,
        lastFailureAtMs: ok ? 0 : now,
        cooldownUntilMs: 0,
      },
    });
  }

  const report: HealthReport = {
    generatedAt: new Date().toISOString(),
    totalModels: entries.length,
    healthy: results.filter((r) => r.ok).length,
    degraded: results.filter((r) => !r.ok).length,
    results,
  };

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  return report;
}

async function probeModel(model: string, provider: string): Promise<boolean> {
  const baseURL = getBaseURL(provider);
  if (!baseURL) return false;
  const apiKey = getApiKey(provider);

  const url = `${baseURL}/chat/completions`;
  const body = JSON.stringify({
    model,
    messages: [{ role: 'system', content: 'You are a tool-calling assistant.' }],
    tool_calls_turns: [{ role: 'assistant', content: PROBE_TEST_INSTRUCTION }],
    temperature: 0,
    max_tokens: 100,
  });

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(provider === 'anthropic' ? {} : { Authorization: `Bearer ${apiKey}` }),
      },
      body,
    });

    if (!resp.ok) {
      const txt = await resp.text();
      if (resp.status === 429) return false;
      return false;
    }

    const data = await resp.json() as any;
    const toolCalls = (data.choices?.[0]?.message?.tool_calls) || (data.candidates?.[0]?.contentParts);
    return Array.isArray(toolCalls) && toolCalls.length > 0;
  } catch {
    return false;
  }
}

function getBaseURL(provider: string): string {
  switch (provider) {
    case 'anthropic':
      return '';
    case 'google':
      return 'https://generativelanguage.googleapis.com/v1beta';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1';
    case 'groq':
      return 'https://api.groq.com/openai/v1';
    case 'ollama':
      return 'http://localhost:11434';
    default:
      return '';
  }
}

function getApiKey(provider: string): string {
  const map: Record<string, string> = {
    anthropic: process.env.ANTHROPIC_API_KEY || '',
    google: process.env.GOOGLE_API_KEY || '',
    openrouter: process.env.OPENROUTER_API_KEY || '',
    groq: process.env.GROQ_API_KEY || '',
  };
  return map[provider] || '';
}
