/**
 * src/providers/index.ts
 * LLM provider adapters barrel export.
 */

export { AnthropicProvider, GoogleProvider, OpenRouterProvider, createProvider, detectProviderFromAPIKey } from './llm.js';
export type { ProviderAdapter } from './llm.js';
export type { ChatParams, ChatResult, StreamChunk, ToolDefinition } from '../types.js';
