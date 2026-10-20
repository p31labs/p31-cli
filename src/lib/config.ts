/**
 * src/lib/config.ts
 * Configuration loader for @p31/cli v3.
 * Loads opencode.json, manages providers, sessions, and P31 settings.
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { createSessionStore } from '../session-store.js';
import type { P31Config, ProviderConfig, SpoonLevel, OpenCodeConfig } from '../types.js';
import type { Role } from './rbac.js';

export type { P31Config, ProviderConfig, SpoonLevel, OpenCodeConfig } from '../types.js';

export const SPOON_LEVELS = {
  MINIMAL: 1,
  STANDARD: 3,
  FULL: 5,
} as const;

export function defaultConfig(): P31Config {
  return {
    spoonLevel: 3 as SpoonLevel,
    sessionId: crypto.randomUUID().slice(0, 8),
    projectRoot: process.cwd(),
    mcpServerUrl: process.env.P31_MCP_URL || 'http://localhost:3000/mcp',
    websocketPort: 3001,
    model: 'deepseek-v4-flash',
    role: (process.env.P31_ROLE as Role) || 'operator',
    providers: [
      {
        id: 'openrouter',
        name: 'OpenRouter',
        apiKey: process.env.OPENROUTER_API_KEY || '',
        baseURL: 'https://openrouter.ai/api/v1',
        models: ['deepseek-v4-flash', 'deepseek-v4', 'qwen3-coder', 'llama-4-maverick'],
        defaultModel: 'deepseek-v4-flash',
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        baseURL: 'https://api.anthropic.com/v1',
        models: ['claude-sonnet-4-6', 'claude-opus-4', 'claude-haiku-3-5'],
        defaultModel: 'claude-sonnet-4-6',
      },
      {
        id: 'google',
        name: 'Google Gemini',
        apiKey: process.env.GOOGLE_API_KEY || '',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
        defaultModel: 'gemini-2.5-flash',
      },
    ],
    activeProvider: 'openrouter',
    sessionDir: path.join(os.homedir(), '.p31', 'sessions'),
  };
}

const CONFIG_PATH = path.join(os.homedir(), '.p31', 'config.json');
const OPENCODE_CONFIG_PATH = path.join(process.cwd(), 'opencode.json');

let cachedConfig: P31Config | null = null;
let sessionStoreInstance: ReturnType<typeof createSessionStore> | null = null;

export async function loadConfig(forceReload = false): Promise<P31Config> {
  if (!forceReload && cachedConfig) return cachedConfig;

  const base = defaultConfig();

  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    const saved = JSON.parse(data);
    cachedConfig = { ...base, ...saved };
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      console.warn(`Warning: Failed to load config: ${err.message}`);
    }
    cachedConfig = base;
  }

  return cachedConfig!;
}

export async function saveConfig(config: P31Config): Promise<void> {
  const configDir = path.join(os.homedir(), '.p31');
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  cachedConfig = config;
}

export async function loadOpenCodeConfig(): Promise<OpenCodeConfig | null> {
  try {
    const data = await fs.readFile(OPENCODE_CONFIG_PATH, 'utf-8');
    return JSON.parse(data) as OpenCodeConfig;
  } catch {
    return null;
  }
}

export function getSessionStore() {
  if (!sessionStoreInstance) {
    sessionStoreInstance = createSessionStore();
  }
  return sessionStoreInstance;
}

export async function getRole(): Promise<Role> {
  const config = await loadConfig();
  return (config.role as Role) || 'operator';
}

export function detectProvider(apiKey: string): ProviderConfig | undefined {
  const key = apiKey.trim();
  if (key.startsWith('sk-ant-')) {
    return {
      id: 'anthropic',
      name: 'Anthropic',
      apiKey: key,
      baseURL: 'https://api.anthropic.com/v1',
      models: ['claude-sonnet-4-6', 'claude-opus-4', 'claude-haiku-3-5'],
      defaultModel: 'claude-sonnet-4-6',
    };
  }
  if (key.startsWith('AIza')) {
    return {
      id: 'google',
      name: 'Google Gemini',
      apiKey: key,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
      defaultModel: 'gemini-2.5-flash',
    };
  }
  if (key.startsWith('sk-or-') || key.startsWith('sk-')) {
    return {
      id: 'openrouter',
      name: 'OpenRouter',
      apiKey: key,
      baseURL: 'https://openrouter.ai/api/v1',
      models: ['deepseek-v4-flash', 'deepseek-v4', 'qwen3-coder', 'llama-4-maverick'],
      defaultModel: 'deepseek-v4-flash',
    };
  }
  return undefined;
}
