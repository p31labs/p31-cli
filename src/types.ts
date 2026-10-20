/**
 * src/types.ts
 * Shared types for @p31/cli v3.
 */

export type SpoonLevel = 1 | 3 | 5;

export interface Session {
  id: string;
  parentId?: string;
  title: string;
  model: string;
  spoonLevel: SpoonLevel;
  status: 'active' | 'archived' | 'compacted';
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  metadata: Record<string, unknown>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: ToolResult;
}

export interface ToolResult {
  callId: string;
  content: string;
  isError?: boolean;
  duration?: number;
}

export interface ProviderConfig {
  id: string;
  name: string;
  apiKey: string;
  baseURL: string;
  models: string[];
  defaultModel: string;
}

export interface P31Config {
  spoonLevel: SpoonLevel;
  sessionId: string;
  projectRoot: string;
  mcpServerUrl?: string;
  websocketPort?: number;
  model?: string;
  role?: 'admin' | 'operator' | 'viewer';
  providers: ProviderConfig[];
  activeProvider?: string;
  sessionDir?: string;
}

export interface OpenCodeConfig {
  p31: {
    version: string;
    defaultSpoonLevel: SpoonLevel;
    themes: ('p31ca' | 'phosphorus31' | 'crisis')[];
    defaultTheme: 'p31ca' | 'phosphorus31';
  };
  mcp: Record<string, {
    type: 'local' | 'remote';
    command?: string[];
    url?: string;
    environment?: Record<string, string>;
  }>;
  providers: {
    default: string;
    list: Record<string, {
      apiKey: string;
      baseURL: string;
      models: string[];
    }>;
  };
  session: {
    dir?: string;
    autoCompact: boolean;
    maxContextTokens: number;
  };
}

export interface ChatParams {
  model: string;
  messages: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
}

export interface ChatResult {
  content: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  stopReason: string;
}

export interface StreamChunk {
  delta: string;
  done: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}
