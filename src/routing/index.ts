/**
 * src/routing/index.ts — Capability-bucket router for P31 Sovereign Enterprise MVP.
 *
 * Pool of free + paid providers with automatic failover and per-model cooldowns.
 * Agents declare a capability bucket; the router resolves a concrete model.
 * No model name ever appears in agent config.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  ProviderConfig,
  ChatParams,
  ChatResult,
  ToolDefinition,
} from '../types.js';
import { CooldownManager, classifyError } from './cooldown.js';
import type { ErrorClass, HealthState } from './cooldown.js';
import {
  bucketAllowsRemote,
  bucketMustBeLocal,
  formatDeploymentSummary,
  getDefaultRoutingPolicy,
  getDeploymentMode,
  isLocalProvider,
  providerAllowed,
} from '../lib/deployment.js';

export type CapabilityBucket =
  | 'fast-code'
  | 'deep-reasoning'
  | 'structured-json'
  | 'summarize'
  | 'vision'
  | 'local-sovereign';

export type CostTier = 'free' | 'cheap' | 'standard' | 'premium';

export type ProviderId = string;

export interface ModelEntry {
  model: string;
  provider: ProviderId;
  costTier: CostTier;
  capabilities: Set<CapabilityBucket>;
}

export interface Candidate {
  entry: ModelEntry;
  priority: number;
}

export interface RouteRequest {
  bucket: CapabilityBucket;
  constraints?: {
    maxLatencyMs?: number;
    minContextWindow?: number;
    requireStructuredOutput?: boolean;
    requireToolCalling?: boolean;
    requireVision?: boolean;
    maxCostTier?: CostTier;
  };
  sessionId: string;
  agentId: string;
}

export interface RouteDecision {
  bucket: CapabilityBucket;
  candidatesConsidered: string[];
  selectedModel: string;
  selectedProvider: string;
  selectionReason: string;
  fallbackDepth: number;
  latencyMs: number;
  errorClass?: ErrorClass;
  policyId: string;
  timestamp: string;
  /** L1-J: health-report.json excluded count (ok:false) when a report was loaded. */
  healthReportExcluded?: number;
  /** L1-J: path of health report used for exclusion, if any. */
  healthReportPath?: string;
}

interface BucketConfig {
  primary: ModelEntry;
  fallbacks: ModelEntry[];
}

const BUCKET_CONFIGS: Record<CapabilityBucket, BucketConfig> = {
  'fast-code': {
    primary: {
      model: 'openrouter/deepseek/deepseek-v4-flash',
      provider: 'openrouter',
      costTier: 'cheap',
      capabilities: new Set(['fast-code'] as CapabilityBucket[]),
    },
    fallbacks: [
      { model: 'groq/llama-3.1-8b-instant', provider: 'groq', costTier: 'free', capabilities: new Set(['fast-code'] as CapabilityBucket[]) },
      { model: 'openrouter/google/gemini-2.0-flash', provider: 'openrouter', costTier: 'free', capabilities: new Set(['fast-code'] as CapabilityBucket[]) },
      { model: 'openrouter/qwen/qwen3-coder:free', provider: 'openrouter', costTier: 'free', capabilities: new Set(['fast-code'] as CapabilityBucket[]) },
    ],
  },
  'deep-reasoning': {
    primary: {
      model: 'openrouter/anthropic/claude-sonnet-4-6',
      provider: 'anthropic',
      costTier: 'standard',
      capabilities: new Set(['deep-reasoning'] as CapabilityBucket[]),
    },
    fallbacks: [
      { model: 'openrouter/google/gemini-2.5-pro', provider: 'openrouter', costTier: 'standard', capabilities: new Set(['deep-reasoning'] as CapabilityBucket[]) },
      { model: 'openrouter/deepseek/deepseek-coder-v2', provider: 'openrouter', costTier: 'standard', capabilities: new Set(['deep-reasoning'] as CapabilityBucket[]) },
      { model: 'openrouter/google/gemini-1.5-pro', provider: 'openrouter', costTier: 'standard', capabilities: new Set(['deep-reasoning'] as CapabilityBucket[]) },
    ],
  },
  'structured-json': {
    primary: {
      model: 'openrouter/qwen/qwen3-coder',
      provider: 'openrouter',
      costTier: 'standard',
      capabilities: new Set(['structured-json']),
    },
    fallbacks: [
      { model: 'openrouter/deepseek/deepseek-v4', provider: 'openrouter', costTier: 'standard', capabilities: new Set(['structured-json']) },
      { model: 'groq/llama-3.1-8b-instant', provider: 'groq', costTier: 'free', capabilities: new Set(['structured-json']) },
    ],
  },
  summarize: {
    primary: {
      model: 'openrouter/google/gemini-2.0-flash',
      provider: 'openrouter',
      costTier: 'free',
      capabilities: new Set(['summarize']),
    },
    fallbacks: [
      { model: 'groq/llama-3.1-8b-instant', provider: 'groq', costTier: 'free', capabilities: new Set(['summarize']) },
      { model: 'openrouter/nvidia/nemotron-3-super:free', provider: 'openrouter', costTier: 'free', capabilities: new Set(['summarize']) },
    ],
  },
  vision: {
    primary: {
      model: 'openrouter/google/gemini-2.5-flash',
      provider: 'openrouter',
      costTier: 'cheap',
      capabilities: new Set(['vision']),
    },
    fallbacks: [
      { model: 'openrouter/google/gemini-1.5-flash', provider: 'openrouter', costTier: 'cheap', capabilities: new Set(['vision']) },
      { model: 'groq/llama-3.1-8b-instant', provider: 'groq', costTier: 'free', capabilities: new Set(['vision']) },
    ],
  },
  'local-sovereign': {
    primary: {
      model: 'ollama/llama4-maverick',
      provider: 'ollama',
      costTier: 'free',
      capabilities: new Set(['local-sovereign', 'fast-code']),
    },
    fallbacks: [
      { model: 'ollama/llama-3.3-70b', provider: 'ollama', costTier: 'free', capabilities: new Set(['local-sovereign', 'fast-code']) },
      { model: 'ollama/qwen2.5:7b', provider: 'ollama', costTier: 'free', capabilities: new Set(['local-sovereign', 'fast-code']) },
    ],
  },
};

/**
 * ProviderPool: maps provider+model -> ModelEntry with capability tags,
 * cost tier, and health state.
 */
export class ProviderPool {
  private entries = new Map<string, ModelEntry>();

  register(entry: ModelEntry): void {
    this.entries.set(`${entry.provider}/${entry.model}`, entry);
  }

  unregister(model: string, provider: string): void {
    this.entries.delete(`${provider}/${model}`);
  }

  unregisterProvider(provider: string): void {
    for (const [key] of this.entries) {
      const [p] = key.split('/');
      if (p === provider) this.entries.delete(key);
    }
  }

  has(model: string, provider: string): boolean {
    return this.entries.has(`${provider}/${model}`);
  }

  getModel(model: string, provider: string): ModelEntry | undefined {
    return this.entries.get(`${provider}/${model}`);
  }

  allEntries(): ModelEntry[] {
    return Array.from(this.entries.values());
  }

  size(): number {
    return this.entries.size;
  }
}

/**
 * SelectionLog: records every route decision (bounded ring buffer).
 */
export class SelectionLog {
  private logs: RouteDecision[] = [];
  private maxLogs = 256;

  log(decision: RouteDecision): void {
    this.logs.push(decision);
    if (this.logs.length > this.maxLogs) this.logs.shift();
  }

  entries(): readonly RouteDecision[] {
    return this.logs.slice(-100);
  }

  count(): number {
    return this.logs.length;
  }
}

export class RoutingError extends Error {
  decision: RouteDecision;
  constructor(message: string, decision: RouteDecision) {
    super(message);
    this.name = 'RoutingError';
    this.decision = decision;
  }
}

/**
 * CapabilityRouter: resolves a bucket -> ordered candidate list, applies
 * cooldown filtering, executes via adapter factory, records decisions.
 */
export class CapabilityRouter {
  private pool: ProviderPool;
  private cooldowns: CooldownManager;
  private log: SelectionLog;
  private adapterFactory: (model: string, provider: string) => { chat: (p: ChatParams) => Promise<ChatResult> };
  private lastHealthExclusion: { path: string; count: number } | null = null;

  constructor(
    pool?: ProviderPool,
    cooldowns?: CooldownManager,
    log?: SelectionLog,
    adapterFactory?: (model: string, provider: string) => { chat: (p: ChatParams) => Promise<ChatResult> },
  ) {
    this.pool = pool ?? new ProviderPool();
    this.cooldowns = cooldowns ?? new CooldownManager();
    this.log = log ?? new SelectionLog();
    this.adapterFactory = adapterFactory ?? defaultAdapterFactory;
    // Only populate default bucket configs if the pool is empty (i.e., no pool was injected)
    if (this.pool.size() === 0) this.populateDefaultPool();
  }

  /** L1-J: load health report (P31_HEALTH_REPORT or ./health-report.json). */
  private loadHealthReport(): { path: string; degraded: Set<string> } | null {
    const envPath = process.env.P31_HEALTH_REPORT;
    const candidates = [envPath, 'health-report.json', './health-report.json'].filter(Boolean) as string[];
    for (const raw of candidates) {
      try {
        const p = resolve(raw);
        if (!existsSync(p)) continue;
        const data = JSON.parse(readFileSync(p, 'utf8'));
        const results = Array.isArray(data?.results) ? data.results : [];
        const degraded = new Set<string>();
        for (const r of results) {
          if (r && r.ok === false && typeof r.model === 'string') degraded.add(r.model);
        }
        return { path: p, degraded };
      } catch {
        // ignore malformed/unreadable report; do not block routing
      }
    }
    return null;
  }

  private populateDefaultPool(): void {
    for (const bucket of Object.keys(BUCKET_CONFIGS) as CapabilityBucket[]) {
      const cfg = BUCKET_CONFIGS[bucket];
      this.registerModel(cfg.primary.model, cfg.primary.provider, cfg.primary.costTier, bucket);
      for (const fb of cfg.fallbacks) {
        this.registerModel(fb.model, fb.provider, fb.costTier, bucket);
      }
    }
  }

  private registerModel(
    model: string,
    provider: string,
    costTier: CostTier,
    bucket: CapabilityBucket,
  ): void {
    this.pool.register({ model, provider, costTier, capabilities: new Set([bucket]) });
  }

  /**
   * Resolve a bucket to an ordered candidate list (primary first, then fallbacks),
   * filtered by constraints and deployment routing policy (G6).
   * Deployment mode affects routing only; it never affects provenance schema/offline verification.
   */
  resolveCandidates(request: RouteRequest): Candidate[] {
    const cfg = BUCKET_CONFIGS[request.bucket];
    let all: Candidate[] = [
      { entry: cfg.primary, priority: 0 },
      ...cfg.fallbacks.map((e, i) => ({ entry: e, priority: i + 1 })),
    ];

    // Apply maxCostTier constraint
    if (request.constraints?.maxCostTier) {
      const tierOrder: CostTier[] = ['free', 'cheap', 'standard', 'premium'];
      const maxIdx = tierOrder.indexOf(request.constraints.maxCostTier);
      all = all.filter(
        (c) => tierOrder.indexOf(c.entry.costTier) <= maxIdx,
      );
    }

    // Apply deployment policy (mode and/or P31_ROUTING_POLICY_FILE).
    // Backward compatible when neither is configured.
    const mode = getDeploymentMode();
    const policy = getDefaultRoutingPolicy(mode);
    const hasDeploymentPolicy = mode !== undefined || policy.source === 'policy-file';
    if (hasDeploymentPolicy) {
      const localOnly = bucketMustBeLocal(request.bucket, policy);
      const allowRemote = bucketAllowsRemote(request.bucket, policy);
      all = all.filter((c) => {
        if (!providerAllowed(c.entry.provider, policy)) return false;
        if (localOnly && !isLocalProvider(c.entry.provider)) return false;
        if (!allowRemote && !isLocalProvider(c.entry.provider)) return false;
        return true;
      });
    }

    // L1-J: exclude models marked ok:false by health-report.json / P31_HEALTH_REPORT
    this.lastHealthExclusion = null;
    const health = this.loadHealthReport();
    if (health) {
      const before = all.length;
      if (health.degraded.size > 0) {
        all = all.filter((c) => {
          const full = `${c.entry.provider}/${c.entry.model}`;
          return !health.degraded.has(c.entry.model) && !health.degraded.has(full);
        });
      }
      const excluded = before - all.length;
      this.lastHealthExclusion = { path: health.path, count: excluded };
    }

    return all;
  }

  private meetsConstraints(entry: ModelEntry, constraints?: RouteRequest['constraints']): boolean {
    if (!constraints) return true;
    if (constraints.requireVision && !entry.capabilities.has('vision')) return false;
    if (constraints.requireStructuredOutput && !entry.capabilities.has('structured-json')) return false;
    if (constraints.requireToolCalling && !entry.capabilities.has('fast-code')) return false;
    return true;
  }

  /**
   * Route: pick the first non-cooled candidate matching constraints, execute,
   * and on retryable failure fall back to the next candidate. Records decision.
   */
  async route(request: RouteRequest): Promise<RouteDecision> {
    const mode = getDeploymentMode();
    const deployPolicy = getDefaultRoutingPolicy(mode);
    const policyId = request.sessionId;
    const candidates = this.resolveCandidates(request);
    const startTime = Date.now();

    const healthEx = this.lastHealthExclusion;
    const candidatesConsidered = candidates.map((c) => `${c.entry.provider}/${c.entry.model}`);
    const deployTag = mode
      ? ` [deployment=${mode} policy=${deployPolicy.policyId}]`
      : deployPolicy.source === 'policy-file'
        ? ` [policy=${deployPolicy.policyId} file=${deployPolicy.policyFile ?? '(unknown)'}]`
        : '';
    const healthTag = healthEx ? ` [healthReport=${healthEx.path} excludedOkFalse=${healthEx.count}]` : '';
    const healthFields = healthEx ? { healthReportExcluded: healthEx.count, healthReportPath: healthEx.path } : {};

    // G6/L8.3: reject clearly when deployment policy leaves no routable candidates
    if (candidates.length === 0) {
      const baseReason = mode === 'airgap'
        ? `Airgap mode blocks non-local routing for bucket '${request.bucket}'. Only local-sovereign/local providers are allowed.${deployTag}`
        : deployPolicy.source === 'policy-file'
          ? `Routing policy file '${deployPolicy.policyFile ?? '(unknown)'}' (policyId=${deployPolicy.policyId}) blocked all candidates for bucket '${request.bucket}'.${deployTag}`
          : `Deployment policy blocked all candidates for bucket '${request.bucket}'.${deployTag}`;
      const reason = `${baseReason}${healthTag}`;
      const decision: RouteDecision = {
        bucket: request.bucket,
        candidatesConsidered: [],
        selectedModel: '(none)',
        selectedProvider: '(none)',
        selectionReason: reason,
        fallbackDepth: 0,
        latencyMs: Date.now() - startTime,
        errorClass: mode === 'airgap' ? '403' : undefined,
        policyId,
        timestamp: new Date().toISOString(),
        ...healthFields,
      };
      this.log.log(decision);
      throw new RoutingError(reason, decision);
    }

    // Pick first viable candidate
    let selectedIndex = candidates.findIndex(
      (c) => !this.cooldowns.isCoolingDown(`${c.entry.provider}/${c.entry.model}`) && this.meetsConstraints(c.entry, request.constraints),
    );
    if (selectedIndex < 0) {
      // All cooled: pick earliest priority candidate anyway as last resort
      selectedIndex = candidates.findIndex((c) => this.meetsConstraints(c.entry, request.constraints));
    }
    if (selectedIndex < 0) {
      selectedIndex = 0; // absolute last resort
    }

    let selectedEntry = candidates[selectedIndex].entry;
    let fallbackDepth = 0;
    let lastErrorClass: ErrorClass | undefined;

    for (let attempt = 0; attempt <= candidates.length; attempt++) {
      const modelKey = `${selectedEntry.provider}/${selectedEntry.model}`;

      try {
        const adapter = this.adapterFactory(selectedEntry.model, selectedEntry.provider);
        const params = buildChatParams(selectedEntry.model);
        await runWithTimeout(adapter.chat(params), 60_000);
        // Success: record and return
        const decision: RouteDecision = {
          bucket: request.bucket,
          candidatesConsidered,
          selectedModel: `${selectedEntry.provider}/${selectedEntry.model}`,
          selectedProvider: selectedEntry.provider,
          selectionReason: (fallbackDepth === 0
            ? `Selected primary candidate for ${request.bucket}`
            : `Fallback #${fallbackDepth} to ${selectedEntry.provider}/${selectedEntry.model}`) + healthTag + deployTag,
          fallbackDepth,
          latencyMs: Date.now() - startTime,
          errorClass: 'none',
          policyId,
          timestamp: new Date().toISOString(),
          ...healthFields,
        };
        this.cooldowns.recordSuccess(modelKey);
        this.log.log(decision);
        return decision;
      } catch (err) {
        const errorClass = classifyError(err as Error) ?? 'none';
        lastErrorClass = errorClass;
        if (errorClass !== 'none') {
          this.cooldowns.recordFailure(modelKey, errorClass);
        }

        // Find next non-cooled candidate after this one
        const nextIndex = candidates.findIndex(
          (c, i) =>
            i > attempt &&
            !this.cooldowns.isCoolingDown(`${c.entry.provider}/${c.entry.model}`) &&
            this.meetsConstraints(c.entry, request.constraints),
        );

        if (nextIndex < 0) break; // no more candidates
        selectedEntry = candidates[nextIndex].entry;
        fallbackDepth = attempt + 1;
      }
    }

    // All candidates exhausted
    const finalDecision: RouteDecision = {
      bucket: request.bucket,
      candidatesConsidered,
      selectedModel: `${selectedEntry.provider}/${selectedEntry.model}`,
      selectedProvider: selectedEntry.provider,
      selectionReason: `All candidates exhausted for ${request.bucket} (last error: ${lastErrorClass ?? 'unknown'})${healthTag}${deployTag}`,
      fallbackDepth,
      latencyMs: Date.now() - startTime,
      errorClass: lastErrorClass,
      policyId,
      timestamp: new Date().toISOString(),
      ...healthFields,
    };
    this.log.log(finalDecision);
    throw new RoutingError(`All candidates exhausted for bucket ${request.bucket}`, finalDecision);
  }

  getPool(): ProviderPool { return this.pool; }
  getCooldowns(): CooldownManager { return this.cooldowns; }
  getLog(): SelectionLog { return this.log; }
}

let cachedRouter: CapabilityRouter | null = null;

export function getRouter(): CapabilityRouter {
  if (!cachedRouter) cachedRouter = new CapabilityRouter();
  return cachedRouter;
}

export function resetRouter(): void {
  cachedRouter = null;
}

/* ------------------------------------------------------------------ */
/* Adapter factory + helpers                                          */
/* ------------------------------------------------------------------ */

export interface RoutableAdapter {
  chat(params: ChatParams): Promise<ChatResult>;
}

function defaultAdapterFactory(
  model: string,
  provider: string,
): { chat: (p: ChatParams) => Promise<ChatResult> } {
  return createRoutedProvider(model, provider);
}

/**
 * createRoutedProvider(model, provider) — returns a ProviderAdapter whose
 * chat() is routed through the cooldown pool for that provider/model.
 * This is the factory called by L1.3 fallback wrapper.
 */
export function createRoutedProvider(
  model: string,
  provider: string,
): RoutableAdapter {
  const config = toProviderConfig(model, provider);
  const base = createProviderFromConfig(config);

  return {
    id: provider,
    name: provider,
    async chat(params: ChatParams): Promise<ChatResult> {
      return base.chat(params);
    },
  };
}

function toProviderConfig(model: string, provider: string): ProviderConfig {
  let apiKey = '';
  let baseURL = '';
  switch (provider) {
    case 'anthropic':
      apiKey = process.env.ANTHROPIC_API_KEY || '';
      baseURL = '';
      break;
    case 'google':
      apiKey = process.env.GOOGLE_API_KEY || '';
      baseURL = 'https://generativelanguage.googleapis.com/v1beta';
      break;
    case 'openrouter':
      apiKey = process.env.OPENROUTER_API_KEY || '';
      baseURL = 'https://openrouter.ai/api/v1';
      break;
    case 'groq':
      apiKey = process.env.GROQ_API_KEY || '';
      baseURL = 'https://api.groq.com/openai/v1';
      break;
    case 'ollama':
      apiKey = '';
      baseURL = 'http://localhost:11434';
      break;
    default:
      apiKey = '';
      baseURL = '';
  }
  return { id: provider, name: provider, apiKey, baseURL, models: [], defaultModel: model };
}

function createProviderFromConfig(config: ProviderConfig): RoutableAdapter {
  const lower = config.id.toLowerCase();
  const importCreateProvider = async () => {
    const mod = await import('../providers/llm.js');
    return mod.createProvider(config);
  };
  // Synchronous path: we can't await at module level, so build inline adapter
  if (lower.includes('anthropic') || lower.includes('claude')) {
    return new AnthropicInlineProvider(config);
  }
  if (lower.includes('google') || lower.includes('gemini')) {
    return new GoogleInlineProvider(config);
  }
  return new OpenRouterInlineProvider(config);
}

class AnthropicInlineProvider implements RoutableAdapter {
  id: string;
  name = 'Anthropic';
  private config: ProviderConfig;
  constructor(config: ProviderConfig) { this.id = config.id; this.config = config; }
  async chat(params: ChatParams): Promise<ChatResult> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens || 4096,
        system: params.systemPrompt,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        tools: params.tools,
      }),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} — ${error}`);
    }
    const data = await response.json() as any;
    const content = data.content?.[0]?.type === 'text' ? data.content[0].text : '';
    return {
      content,
      model: data.model,
      usage: {
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0,
        totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
      stopReason: data.stop_reason || 'end_turn',
    };
  }
}

class GoogleInlineProvider implements RoutableAdapter {
  id: string;
  name = 'Google Gemini';
  private config: ProviderConfig;
  constructor(config: ProviderConfig) { this.id = config.id; this.config = config; }
  async chat(params: ChatParams): Promise<ChatResult> {
    const model = params.model.replace(/^gemini-/, '');
    const url = `${this.config.baseURL || 'https://generativelanguage.googleapis.com/v1beta'}/models/${model}:generateContent?key=${this.config.apiKey}`;
    const body: Record<string, unknown> = {
      contents: params.messages.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: params.temperature ?? 0.7,
        maxOutputTokens: params.maxTokens || 4096,
      },
    };
    if (params.systemPrompt) body.systemInstruction = { parts: [{ text: params.systemPrompt }] };
    if (params.tools) body.tools = params.tools;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google API error: ${response.status} — ${error}`);
    }
    const data = await response.json() as any;
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || '';
    const usage = data.usageMetadata || {};
    return {
      content,
      model: `gemini-${model}`,
      usage: {
        promptTokens: usage.promptTokenCount ?? 0,
        completionTokens: usage.candidatesTokenCount ?? 0,
        totalTokens: usage.totalTokenCount ?? 0,
      },
      stopReason: candidate?.finishReason || 'STOP',
    };
  }
}

class OpenRouterInlineProvider implements RoutableAdapter {
  id: string;
  name = 'OpenRouter';
  private config: ProviderConfig;
  constructor(config: ProviderConfig) { this.id = config.id; this.config = config; }
  async chat(params: ChatParams): Promise<ChatResult> {
    const baseURL = this.config.baseURL || 'https://openrouter.ai/api/v1';
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'HTTP-Referer': 'https://p31ca.org',
        'X-Title': 'P31 Sovereign CLI',
      },
      body: JSON.stringify({
        model: params.model,
        messages: [
          ...(params.systemPrompt ? [{ role: 'system', content: params.systemPrompt }] : []),
          ...params.messages,
        ],
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens || 4096,
        tools: params.tools,
      }),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} — ${error}`);
    }
    const data = await response.json() as any;
    const choice = data.choices?.[0];
    const content = choice?.message?.content || '';
    return {
      content,
      model: data.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      stopReason: choice?.finish_reason || 'stop',
    };
  }
}

function buildChatParams(model: string): ChatParams {
  return {
    model,
    messages: [{ role: 'user', content: 'Ping' }],
    systemPrompt: 'Respond with a short hello.',
    temperature: 0,
    maxTokens: 50,
  };
}

function runWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export { CooldownManager, classifyError };
export type { HealthState };
