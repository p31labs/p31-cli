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
