/**
 * src/types.ts
 * Shared types for @p31/cli v3.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export type SpoonLevel = 1 | 3 | 5;

/** Instruction precedence levels. Lower number = higher precedence. */
export type InstructionPrecedenceLevel = 1 | 2 | 3 | 4 | 5;

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
  fallbackDepth?: number;
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

// ─── Routing types ────────────────────────────────────────────────────

export type CapabilityBucket =
  | 'fast-code'
  | 'deep-reasoning'
  | 'structured-json'
  | 'summarize'
  | 'vision'
  | 'local-sovereign';

export type CostTier = 'free' | 'cheap' | 'standard' | 'premium';

export type ErrorClass = '429' | 'timeout' | 'quota' | '401' | '403' | 'none';

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
}

// ─── Instruction resolution & hashing (Lane L3) ───────────────────────

export interface InstructionSet {
  source: string;
  hash: string;        // SHA-256 of canonicalized instruction content
  precedenceLevel: 1 | 2 | 3 | 4 | 5;
  loadedAt: string;
}

export interface InstructionSourceRef {
  sourceId: string;
  path: string;
  contentHash: string;
  precedenceLevel: InstructionPrecedenceLevel;
  owner: string;
}

const P31_REPO_ROOT = '/home/p31';

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf-8').digest('hex');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function contentHashOf(filePath: string): string {
  try {
    return sha256Hex(canonicalJson(readFileSync(filePath, 'utf-8')));
  } catch {
    return sha256Hex(canonicalJson(`missing:${filePath}`));
  }
}

function instructionHash(
  sourceId: string,
  contentHash: string,
  precedenceLevel: InstructionPrecedenceLevel
): string {
  return sha256Hex(canonicalJson({ sourceId, contentHash, precedenceLevel }));
}

/**
 * Resolve the instruction hierarchy for an agent and return the governing
 * InstructionSet.
 *
 * Precedence (highest wins; safety invariants ALWAYS WIN):
 *   1 safety invariants (execution guard / spoon gating / crisis flags)
 *   2 harness / runbook
 *   3 product AGENTS.md
 *   4 agent capability manifest
 *   5 session overrides
 *
 * Safety invariants are always applicable and therefore always govern; no
 * lower level can override them. The returned `hash` is the SHA-256 of the
 * canonicalized instruction content of the governing source. It is recorded
 * at provenance.context.instructionHash (Lane L2 schema).
 */
export function loadInstructionSet(agentId: string): InstructionSet {
  const sources: InstructionSourceRef[] = [
    {
      sourceId: 'safety-invariants',
      path: join(P31_REPO_ROOT, 'p31-cli/src/safety/execution-guard.ts'),
      contentHash: contentHashOf(join(P31_REPO_ROOT, 'p31-cli/src/safety/execution-guard.ts')),
      precedenceLevel: 1,
      owner: 'safety',
    },
    {
      sourceId: 'harness-runbook',
      path: join(P31_REPO_ROOT, 'production/AGENTS.md'),
      contentHash: contentHashOf(join(P31_REPO_ROOT, 'production/AGENTS.md')),
      precedenceLevel: 2,
      owner: 'harness',
    },
    {
      sourceId: 'product-agents',
      path: join(P31_REPO_ROOT, 'p31-cli/AGENTS.md'),
      contentHash: contentHashOf(join(P31_REPO_ROOT, 'p31-cli/AGENTS.md')),
      precedenceLevel: 3,
      owner: 'product',
    },
  ];

  const manifestPath = join(P31_REPO_ROOT, 'p31-cli/agents', `${agentId}.json`);
  if (existsSync(manifestPath)) {
    sources.push({
      sourceId: `agent:${agentId}`,
      path: manifestPath,
      contentHash: contentHashOf(manifestPath),
      precedenceLevel: 4,
      owner: 'capability',
    });
  }

  const sessionPath = join(homedir(), '.p31', 'cli-session-instructions.json');
  if (existsSync(sessionPath)) {
    sources.push({
      sourceId: 'session-overrides',
      path: sessionPath,
      contentHash: contentHashOf(sessionPath),
      precedenceLevel: 5,
      owner: 'session',
    });
  }

  const governing = sources[0]; // safety invariants (level 1) ALWAYS WIN
  const loadedAt = new Date().toISOString();

  return {
    source: governing.sourceId,
    hash: instructionHash(governing.sourceId, governing.contentHash, governing.precedenceLevel),
    precedenceLevel: governing.precedenceLevel,
    loadedAt,
  };
}
