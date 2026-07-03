import { createServer, IncomingMessage, ServerResponse } from 'http';
import { TOOLS } from './mcp-bridge.js';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function createMcpHttpServer(port: number): void {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    for (const [key, value] of Object.entries(corsHeaders)) {
      res.setHeader(key, value);
    }

    if (url.pathname === '/tools' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      }));
      return;
    }

    if (url.pathname.startsWith('/tools/') && req.method === 'POST') {
      const toolName = url.pathname.slice(7);

      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', async () => {
        const args = body ? JSON.parse(body) : {};
        const tool = TOOLS.find((t) => t.name === toolName);

        if (!tool) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Tool "${toolName}" not found` }));
          return;
        }

        try {
          const result = await tool.handler(args);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }));
        }
      });

      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, () => {
    console.log(`MCP HTTP server running on http://localhost:${port}`);
  });
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const port = parseInt(process.argv[2] || process.env.MCP_HTTP_PORT || '3000', 10);
  createMcpHttpServer(port);

  process.on('SIGINT', () => {
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    process.exit(0);
  });
}
