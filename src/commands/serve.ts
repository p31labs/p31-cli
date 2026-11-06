/**
 * src/commands/serve.ts
 * `p31 serve` — starts the MCP HTTP server.
 * Options: --port, --read-only
 */

import { Command } from 'commander';
import chalk from 'chalk';

export function createServeCommand(): Command {
  return new Command('serve')
    .description('Start the MCP HTTP server (JSON-RPC 2.0)')
    .option('--port <port>', 'Server port', '3100')
    .option('--read-only', 'Disable write operations (evidence, escrow, mint, etc.)')
    .action(async (opts) => {
      const port = parseInt(opts.port, 10);

      if (opts.readOnly) {
        process.env.READ_ONLY = '1';
      }

      const { createMcpHttpServer } = await import('../mcp-server.js');
      createMcpHttpServer(port);
    });
}
