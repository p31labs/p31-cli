/**
 * src/providers/llm.ts
 * LLM provider adapters for @p31/cli v3.
 * All providers in one file to avoid module resolution issues during build.
 */

import type { ProviderConfig, ChatParams, ChatResult, ToolDefinition } from '../types.js';

export interface ProviderAdapter {
  id: string;
  name: string;
  chat(params: ChatParams): Promise<ChatResult>;
}

export interface RoutableAdapter extends ProviderAdapter {
  routeBucket?: string;
  fallbackDepth?: number;
}

/**
 * createRoutedProvider(model, provider) — wraps ProviderAdapter.chat with
 * automatic fallback across the bucket's ordered candidate list.
 *
 * On retryable failure (429, timeout, quota, 401, 403), tries the next model
 * in the bucket. Records fallbackDepth on the result. Does not modify the
 * existing ProviderAdapter interface — returns a new adapter.
 */
export function createRoutedProvider(model: string, provider: string): RoutableAdapter {
  const base = createProvider({ id: provider, name: provider, apiKey: '', baseURL: '', models: [], defaultModel: model });

  // Build candidate list: this model first, then bucket fallbacks
  const bucketForModel = bucketFor(model, provider);
  const candidates = buildCandidates(model, provider, bucketForModel);

  return {
    id: provider,
    name: provider,
    routeBucket: bucketForModel,
    fallbackDepth: 0,
    async chat(params: ChatParams): Promise<ChatResult> {
      let lastError: Error | null = null;
      let depth = 0;

      for (let i = 0; i < candidates.length; i++) {
        const cand = candidates[i];
        const adapter = createProvider({
          id: cand.provider,
          name: cand.provider,
          apiKey: '',
          baseURL: cand.provider === 'anthropic' ? '' :
            cand.provider === 'google' ? 'https://generativelanguage.googleapis.com/v1beta' :
            cand.provider === 'groq' ? 'https://api.groq.com/openai/v1' :
            'https://openrouter.ai/api/v1',
          models: [],
          defaultModel: cand.model,
        });

        try {
          const result = await adapter.chat({ ...params, model: cand.model });
          return {
            ...result,
            model: cand.model,
            fallbackDepth: depth,
          };
        } catch (err) {
          lastError = err as Error;
          depth = i + 1;
          const cls = classifyError(lastError);
          if (cls === 'none') throw lastError;
          // retryable: continue to next candidate
        }
      }

      throw lastError ?? new Error(`All candidates exhausted for ${provider}/${model}`);
    },
  };
}

function bucketFor(model: string, provider: string): string | undefined {
  const lower = (provider + '/' + model).toLowerCase();
  if (lower.includes('deepseek-v4-flash') || lower.includes('llama-3.1-8b') || lower.includes('gemini-2.0-flash') || lower.includes('qwen3-coder')) return 'fast-code';
  if (lower.includes('claude-sonnet-4-6') || lower.includes('gemini-2.5-pro') || lower.includes('deepseek-coder-v2') || lower.includes('gemini-1.5-pro')) return 'deep-reasoning';
  if (lower.includes('qwen3-coder') || lower.includes('deepseek-v4')) return 'structured-json';
  if (lower.includes('gemini-2.0-flash') || lower.includes('nemotron') || lower.includes('llama-3.1-8b')) return 'summarize';
  if (lower.includes('gemini-2.5-flash') || lower.includes('gemini-1.5-flash')) return 'vision';
  if (lower.includes('ollama')) return 'local-sovereign';
  return undefined;
}

function buildCandidates(model: string, provider: string, bucket: string | undefined): Array<{ model: string; provider: string }> {
  if (!bucket) return [{ model, provider }];
  const map: Record<string, Array<{ model: string; provider: string }>> = {
    'fast-code': [
      { model: 'openrouter/deepseek/deepseek-v4-flash', provider: 'openrouter' },
      { model: 'groq/llama-3.1-8b-instant', provider: 'groq' },
      { model: 'openrouter/google/gemini-2.0-flash', provider: 'openrouter' },
    ],
    'deep-reasoning': [
      { model: 'openrouter/anthropic/claude-sonnet-4-6', provider: 'anthropic' },
      { model: 'openrouter/google/gemini-2.5-pro', provider: 'openrouter' },
      { model: 'openrouter/deepseek/deepseek-coder-v2', provider: 'openrouter' },
    ],
    'structured-json': [
      { model: 'openrouter/qwen/qwen3-coder', provider: 'openrouter' },
      { model: 'openrouter/deepseek/deepseek-v4', provider: 'openrouter' },
      { model: 'groq/llama-3.1-8b-instant', provider: 'groq' },
    ],
    summarize: [
      { model: 'openrouter/google/gemini-2.0-flash', provider: 'openrouter' },
      { model: 'groq/llama-3.1-8b-instant', provider: 'groq' },
      { model: 'openrouter/nvidia/nemotron-3-super:free', provider: 'openrouter' },
    ],
    vision: [
      { model: 'openrouter/google/gemini-2.5-flash', provider: 'openrouter' },
      { model: 'openrouter/google/gemini-1.5-flash', provider: 'openrouter' },
      { model: 'groq/llama-3.1-8b-instant', provider: 'groq' },
    ],
    'local-sovereign': [
      { model: 'ollama/llama4-maverick', provider: 'ollama' },
      { model: 'ollama/llama-3.3-70b', provider: 'ollama' },
    ],
  };
  return map[bucket] ?? [{ model, provider }];
}

function classifyError(err: Error): '429' | 'timeout' | 'quota' | '401' | '403' | 'none' {
  const msg = err.message.toLowerCase();
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) return '429';
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('hang')) return 'timeout';
  if (msg.includes('quota') || msg.includes('exhausted') || msg.includes('daily')) return 'quota';
  if (msg.includes('401') || msg.includes('invalid api key')) return '401';
  if (msg.includes('403') || msg.includes('permission denied') || msg.includes('forbidden')) return '403';
  return 'none';
}

export interface StreamChunk {
  delta: string;
  done: boolean;
}

export class AnthropicProvider implements ProviderAdapter {
  id: string;
  name = 'Anthropic';
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.id = config.id;
    this.config = config;
  }

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

export class GoogleProvider implements ProviderAdapter {
  id: string;
  name = 'Google Gemini';
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.id = config.id;
    this.config = config;
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const baseURL = this.config.baseURL || 'https://generativelanguage.googleapis.com/v1beta';
    const model = params.model.replace(/^gemini-/, '');
    const url = `${baseURL}/models/${model}:generateContent?key=${this.config.apiKey}`;

    const systemInstruction = params.systemPrompt
      ? { parts: [{ text: params.systemPrompt }] }
      : undefined;

    const contents = params.messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: params.temperature ?? 0.7,
        maxOutputTokens: params.maxTokens || 4096,
      },
    };
    if (systemInstruction) body.systemInstruction = systemInstruction;
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

export class OpenRouterProvider implements ProviderAdapter {
  id: string;
  name = 'OpenRouter';
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.id = config.id;
    this.config = config;
  }

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

export function createProvider(config: ProviderConfig): ProviderAdapter {
  const lower = config.id.toLowerCase();
  if (lower.includes('anthropic') || lower.includes('claude')) {
    return new AnthropicProvider(config);
  }
  if (lower.includes('google') || lower.includes('gemini')) {
    return new GoogleProvider(config);
  }
  return new OpenRouterProvider(config);
}

export function detectProviderFromAPIKey(apiKey: string): string {
  if (apiKey.startsWith('sk-ant-')) return 'anthropic';
  if (apiKey.startsWith('AIza')) return 'google';
  if (apiKey.startsWith('sk-or-')) return 'openrouter';
  if (apiKey.startsWith('sk-')) return 'openrouter';
  return 'openrouter';
}
