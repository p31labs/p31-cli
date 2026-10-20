/**
 * P31 Unified MCP HTTP Server
 * Exposes all 133 MCP tools via HTTP REST API
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { ALL_TOOLS, executeUnifiedTool, TOOL_CATEGORIES, TOTAL_TOOL_COUNT } from './mcp-servers/index.js';

const app = new Hono();

// CORS
app.use('*', cors({
  origin: ['http://localhost:5200', 'http://localhost:3100', 'https://p31ca.org'],
}));

// Health check
app.get('/health', (c) => c.json({ status: 'ok', tools: TOTAL_TOOL_COUNT }));

// Smithery Static Server Card (fallback for scan failures)
app.get('/.well-known/mcp/server-card.json', (c) => {
  return c.json({
    serverInfo: { name: 'P31 Governed Agent CLI', version: '3.1.3' },
    authentication: { required: false, schemes: [] },
    tools: ALL_TOOLS.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  });
});

// MCP Streamable HTTP endpoint (for Smithery URL method)
app.all('/mcp', async (c) => {
  return c.json({
    jsonrpc: '2.0',
    id: null,
    error: { code: -32601, message: 'Streamable HTTP transport not yet implemented. Use stdio via npx @p31ca/cli.' },
  });
});

// RFC 9728 — Protected Resource Metadata
// MCP servers MUST implement this to indicate authorization server locations
app.get('/.well-known/oauth-protected-resource', (c) => {
  return c.json({
    resource: 'https://mcp.p31ca.org',
    authorization_servers: ['https://auth.p31ca.org'],
    scopes_supported: ['mcp:tools', 'mcp:resources', 'mcp:prompts'],
    bearer_methods_supported: ['header'],
    resource_documentation: 'https://p31ca.org/docs/mcp-auth',
  });
});

// RFC 9728 — 401 responses MUST include WWW-Authenticate with resource_metadata
app.use('*', async (c, next) => {
  await next();
  if (c.res.status === 401 && !c.res.headers.get('WWW-Authenticate')) {
    const metadataUrl = 'https://mcp.p31ca.org/.well-known/oauth-protected-resource';
    c.res.headers.set(
      'WWW-Authenticate',
      `Bearer resource_metadata="${metadataUrl}"`
    );
  }
});

// List all tools
app.get('/tools', (c) => c.json({
  tools: ALL_TOOLS,
  total: TOTAL_TOOL_COUNT,
  categories: TOOL_CATEGORIES,
}));

// Get tools by category
app.get('/tools/:category', (c) => {
  const category = c.req.param('category');
  const tools = ALL_TOOLS.filter(t => t.category === category);
  return c.json({ tools, total: tools.length, category });
});

// Get tool info
app.get('/tools/:category/:name', (c) => {
  const name = c.req.param('name');
  const tool = ALL_TOOLS.find(t => t.name === name);
  if (!tool) return c.json({ error: 'Tool not found' }, 404);
  return c.json({ tool });
});

// Call a tool
app.post('/tools/:name', async (c) => {
  const name = c.req.param('name');
  const args = await c.req.json().catch(() => ({}));
  const result = executeUnifiedTool(name, args);
  return c.json(result);
});

// Tasks endpoint (MCP 2026-07-28)
// Long-running operations return a task handle immediately
const tasks = new Map<string, { status: string; result?: any; createdAt: number }>();

app.post('/tasks', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  tasks.set(taskId, { status: 'running', createdAt: Date.now() });

  // Execute the tool asynchronously
  const name = body.name;
  const args = body.arguments || {};
  setTimeout(() => {
    try {
      const result = executeUnifiedTool(name, args);
      tasks.set(taskId, { status: 'completed', result, createdAt: tasks.get(taskId)!.createdAt });
    } catch (e: any) {
      tasks.set(taskId, { status: 'failed', result: { error: e.message }, createdAt: tasks.get(taskId)!.createdAt });
    }
  }, 0);

  return c.json({ taskId, status: 'running' });
});

app.get('/tasks/:taskId', (c) => {
  const taskId = c.req.param('taskId');
  const task = tasks.get(taskId);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  return c.json({ taskId, ...task });
});

app.post('/tasks/:taskId/cancel', (c) => {
  const taskId = c.req.param('taskId');
  const task = tasks.get(taskId);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (task.status === 'running') {
    tasks.set(taskId, { ...task, status: 'cancelled' });
  }
  return c.json({ taskId, status: task.status });
});

// Start server
const port = process.env.PORT || 3100;
serve({ fetch: app.fetch, port: Number(port) });
console.log(`[p31-mcp-http] Server started on port ${port}`);
console.log(`[p31-mcp-http] ${TOTAL_TOOL_COUNT} tools available across ${TOOL_CATEGORIES.length} categories`);

export { app };
export function createMcpHttpServer(port?: number) {
  if (port) {
    process.env.PORT = String(port);
  }
  return app;
}
export default app;
