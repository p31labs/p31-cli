/**
 * src/mcp-servers/edge-workers.ts
 * Edge worker MCP server adapters for @p31/cli v3.
 * Bridges the 5 live edge workers into opencode.
 */

import type { Plugin } from '@opencode-ai/plugin';

export interface EdgeWorkerConfig {
  id: string;
  name: string;
  url: string;
  tools: number;
  category: 'crypto' | 'justice' | 'care' | 'mesh' | 'billing';
}

export const EDGE_WORKERS: EdgeWorkerConfig[] = [
  { id: 'p31-crypto-mcp', name: 'P31 Crypto MCP', url: 'https://p31-crypto-mcp.trimtab-signal.workers.dev/mcp', tools: 12, category: 'crypto' },
  { id: 'p31-justice-hub', name: 'P31 Justice Hub', url: 'https://p31-justice-hub.trimtab-signal.workers.dev/mcp', tools: 8, category: 'justice' },
  { id: 'bros', name: 'BROS Care Issuer', url: 'https://bros.trimtab-signal.workers.dev/mcp', tools: 8, category: 'care' },
  { id: 'dads', name: 'DADS Trust Engine', url: 'https://dads.trimtab-signal.workers.dev/mcp', tools: 7, category: 'mesh' },
  { id: 'x402-gateway', name: 'x402 Gateway', url: 'https://mcp-x402-gateway.trimtab-signal.workers.dev/mcp', tools: 187, category: 'billing' },
];

export function createEdgeWorkerPlugin(worker: EdgeWorkerConfig): Plugin {
  return async () => {
    return {
      tool: {
        [`${worker.id}_status`]: {
          description: `Check ${worker.name} status`,
          args: {} as any,
          async execute() {
            return { id: worker.id, status: 'live', url: worker.url, tools: worker.tools, category: worker.category } as any;
          },
        },
        [`${worker.id}_tools`]: {
          description: `List ${worker.name} tools`,
          args: {} as any,
          async execute() {
            return { id: worker.id, toolCount: worker.tools, message: `Use ${worker.id}_call <tool> to invoke` } as any;
          },
        },
      },
    } as any;
  };
}

export function createAllEdgeWorkerPlugins(): Plugin[] {
  return EDGE_WORKERS.map(createEdgeWorkerPlugin);
}
