/**
 * src/mcp-server.ts
 * Hono-based MCP HTTP server — JSON-RPC 2.0 over POST /mcp.
 * Exposes all CLI tools (phos-forge, identity, mesh, PQC, sovereign plugins).
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { TOOLS, executeUnifiedTool } from './mcp-bridge.js';
import { getRBAC } from './lib/rbac.js';
import chalk from 'chalk';

const VERSION = '3.1.3';
const PROTOCOL_VERSION = '2026-07-28';

const ALLOWED_ORIGINS = [
  'https://p31ca.org',
  'http://localhost:5200',
  'http://localhost:3100',
];

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function isReadOnly(): boolean {
  return process.env.READ_ONLY === '1';
}

const WRITE_TOOLS = new Set([
  'evidence_upload',
  'escrow_deposit',
  'escrow_release',
  'love_mint',
  'feedback_submit',
  'passport_create',
  'passport_export',
  'phos_spoons',
  'phos_theme',
]);

function createJsonRpcResponse(id: number | string | null, result?: unknown, error?: { code: number; message: string; data?: unknown }): JsonRpcResponse {
  const resp: JsonRpcResponse = { jsonrpc: '2.0', id };
  if (error) {
    resp.error = error;
  } else {
    resp.result = result;
  }
  return resp;
}

export function createMcpHttpServer(port: number): void {
  const app = new Hono();

  app.use('*', cors({
    origin: (origin) => ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }));

  // ── Health ──────────────────────────────────────────────────────────────
  app.get('/mcp/health', (c) => {
    return c.json({ status: 'ok', version: VERSION });
  });

  // ── JSON-RPC 2.0 endpoint ──────────────────────────────────────────────
  app.post('/mcp', async (c) => {
    let body: JsonRpcRequest;
    try {
      body = await c.req.json();
    } catch {
      return c.json(createJsonRpcResponse(null, undefined, {
        code: -32700,
        message: 'Parse error',
      }), 400);
    }

    const { id, method, params } = body;

    // ── initialize ──────────────────────────────────────────────────────
    if (method === 'initialize') {
      return c.json(createJsonRpcResponse(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'p31-cli-mcp', version: VERSION },
      }));
    }

    // ── tools/list ─────────────────────────────────────────────────────
    if (method === 'tools/list') {
      const tools = TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      return c.json(createJsonRpcResponse(id, { tools }));
    }

    // ── tools/call ─────────────────────────────────────────────────────
    if (method === 'tools/call') {
      const toolName = params?.name as string;
      const toolArgs = (params?.arguments as Record<string, unknown>) || {};

      if (!toolName) {
        return c.json(createJsonRpcResponse(id, undefined, {
          code: -32602,
          message: 'Missing tool name',
        }));
      }

      const tool = TOOLS.find((t) => t.name === toolName);
      if (!tool) {
        return c.json(createJsonRpcResponse(id, undefined, {
          code: -32602,
          message: `Tool not found: ${toolName}`,
        }));
      }

      if (isReadOnly() && WRITE_TOOLS.has(toolName)) {
        return c.json(createJsonRpcResponse(id, undefined, {
          code: -32600,
          message: `Tool "${toolName}" is a write operation — server is in read-only mode`,
        }));
      }

      const rbac = getRBAC();
      const isWrite = WRITE_TOOLS.has(toolName);
      const action = isWrite ? 'write' : 'read';
      if (!rbac.can('mcp', action)) {
        return c.json(createJsonRpcResponse(id, undefined, {
          code: -32600,
          message: `Permission denied: role "${rbac.getRole()}" cannot ${action} tool "${toolName}"`,
        }));
      }

      try {
        const result = executeUnifiedTool(toolName, toolArgs);
        return c.json(createJsonRpcResponse(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }));
      } catch (error) {
        return c.json(createJsonRpcResponse(id, {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        }));
      }
    }

    // ── Unknown method ──────────────────────────────────────────────────
    return c.json(createJsonRpcResponse(id, undefined, {
      code: -32601,
      message: `Method not found: ${method}`,
    }));
  });

  // ── Start ────────────────────────────────────────────────────────────────
  const readOnly = isReadOnly();

  const rbac = getRBAC();

  serve({ fetch: app.fetch, port }, () => {
    console.log(chalk.cyan(`\n\u26A1 P31 MCP HTTP Server v${VERSION}`));
    console.log(chalk.gray(`  Port:       ${port}`));
    console.log(chalk.gray(`  Endpoint:   http://localhost:${port}/mcp`));
    console.log(chalk.gray(`  Health:     http://localhost:${port}/mcp/health`));
    console.log(chalk.gray(`  Read-only:  ${readOnly}`));
    console.log(chalk.gray(`  Role:       ${rbac.getRole()}`));
    console.log(chalk.gray(`  CORS:       ${ALLOWED_ORIGINS.join(', ')}`));
    console.log(chalk.gray(`  Protocol:   JSON-RPC 2.0 (MCP ${PROTOCOL_VERSION})`));
    console.log(chalk.gray(`  Tools:      ${TOOLS.length} registered\n`));
  });

  // ── Graceful shutdown ────────────────────────────────────────────────────
  const shutdown = (signal: string) => {
    console.log(chalk.gray(`\n  ${signal} received — shutting down...`));
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// ── Direct invocation ───────────────────────────────────────────────────────
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const port = parseInt(process.env.PORT || '3100', 10);
  createMcpHttpServer(port);
}
