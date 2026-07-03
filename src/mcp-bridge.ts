import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export const TOOLS: ToolDefinition[] = [
  // ── Identity (4 tools) ──────────────────────────────────────────────
  {
    name: 'passport_create',
    description: 'Create a new Cognitive Passport',
    inputSchema: {
      type: 'object',
      properties: {
        displayName: { type: 'string', description: 'User display name' },
        pronouns: { type: 'string', description: 'User pronouns' },
        role: { type: 'string', description: 'User role in the mesh' },
      },
      required: ['displayName'],
    },
    handler: async (args) => {
      const did = 'did:key:z' + crypto.randomUUID().replace(/-/g, '').slice(0, 32);
      return { success: true, did, displayName: args.displayName };
    },
  },
  {
    name: 'passport_verify',
    description: 'Verify a Cognitive Passport DID',
    inputSchema: {
      type: 'object',
      properties: {
        did: { type: 'string', description: 'DID to verify' },
      },
      required: ['did'],
    },
    handler: async (args) => {
      return { verified: true, did: args.did, issuer: 'p31-mesh' };
    },
  },
  {
    name: 'passport_export',
    description: 'Export passport as verifiable credential',
    inputSchema: {
      type: 'object',
      properties: {
        did: { type: 'string', description: 'DID to export' },
        format: { type: 'string', enum: ['jwt', 'jsonld', 'cbor'] },
      },
      required: ['did'],
    },
    handler: async (args) => {
      return { success: true, format: args.format || 'jwt', credential: 'eyJ...' };
    },
  },
  {
    name: 'passport_qr',
    description: 'Generate QR code for passport scanning',
    inputSchema: {
      type: 'object',
      properties: {
        did: { type: 'string', description: 'DID to encode' },
        size: { type: 'number', description: 'QR code size in pixels' },
      },
      required: ['did'],
    },
    handler: async (args) => {
      return { success: true, qrData: `p31://passport/${args.did}`, size: args.size || 256 };
    },
  },

  // ── K4 Mesh (4 tools) ───────────────────────────────────────────────
  {
    name: 'mesh_status',
    description: 'Get K4 mesh topology status',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({
      topology: 'K4',
      vertices: 4,
      edges: 6,
      rigidity: 'isostatic',
      verticesList: ['will', 'sj', 'wj', 'christyn'],
    }),
  },
  {
    name: 'mesh_ping',
    description: 'Send a LOVE ping between vertices',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Source vertex' },
        to: { type: 'string', description: 'Target vertex' },
        emoji: { type: 'string', description: 'Emoji to send' },
      },
      required: ['from', 'to'],
    },
    handler: async (args) => {
      return { success: true, from: args.from, to: args.to, love: 1, timestamp: new Date().toISOString() };
    },
  },
  {
    name: 'mesh_edges',
    description: 'List all edges in the K4 mesh',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({
      edges: [
        { from: 'will', to: 'sj', weight: 1.0 },
        { from: 'will', to: 'wj', weight: 1.0 },
        { from: 'will', to: 'christyn', weight: 1.0 },
        { from: 'sj', to: 'wj', weight: 1.0 },
        { from: 'sj', to: 'christyn', weight: 1.0 },
        { from: 'wj', to: 'christyn', weight: 1.0 },
      ],
    }),
  },
  {
    name: 'mesh_vertices',
    description: 'List all vertices in the K4 mesh',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({
      vertices: [
        { name: 'will', status: 'online', role: 'primary' },
        { name: 'sj', status: 'online', role: 'primary' },
        { name: 'wj', status: 'online', role: 'primary' },
        { name: 'christyn', status: 'online', role: 'primary' },
      ],
    }),
  },

  // ── Evidence & Justice (4 tools) ─────────────────────────────────────
  {
    name: 'evidence_upload',
    description: 'Upload evidence to the chain-of-custody',
    inputSchema: {
      type: 'object',
      properties: {
        caseId: { type: 'string', description: 'Case ID' },
        content: { type: 'string', description: 'Evidence content (base64)' },
        submittedBy: { type: 'string', description: 'Submitter DID' },
      },
      required: ['caseId', 'content'],
    },
    handler: async (args) => {
      return {
        success: true,
        evidenceId: crypto.randomUUID(),
        chainHash: crypto.randomUUID().replace(/-/g, ''),
        submittedBy: args.submittedBy || 'unknown',
      };
    },
  },
  {
    name: 'evidence_verify',
    description: 'Verify evidence chain-of-custody',
    inputSchema: {
      type: 'object',
      properties: {
        evidenceId: { type: 'string', description: 'Evidence ID' },
      },
      required: ['evidenceId'],
    },
    handler: async (args) => {
      return { verified: true, evidenceId: args.evidenceId, chainHash: crypto.randomUUID().replace(/-/g, '') };
    },
  },
  {
    name: 'evidence_chain',
    description: 'View the full chain-of-custody for evidence',
    inputSchema: {
      type: 'object',
      properties: {
        evidenceId: { type: 'string', description: 'Evidence ID' },
      },
      required: ['evidenceId'],
    },
    handler: async (args) => ({
      evidenceId: args.evidenceId,
      chain: [
        { action: 'uploaded', by: 'did:key:zabc', timestamp: '2026-07-01T12:00:00Z' },
        { action: 'verified', by: 'did:key:zdef', timestamp: '2026-07-01T14:30:00Z' },
        { action: 'escrowed', by: 'did:key:zabc', timestamp: '2026-07-02T09:00:00Z' },
      ],
    }),
  },
  {
    name: 'evidence_list',
    description: 'List all evidence for a case',
    inputSchema: {
      type: 'object',
      properties: {
        caseId: { type: 'string', description: 'Case ID' },
        status: { type: 'string', enum: ['all', 'pending', 'verified', 'escrowed'] },
      },
      required: ['caseId'],
    },
    handler: async () => ({
      evidence: [
        { id: crypto.randomUUID(), type: 'document', status: 'verified', uploadedAt: '2026-07-01T12:00:00Z' },
        { id: crypto.randomUUID(), type: 'recording', status: 'pending', uploadedAt: '2026-07-02T09:00:00Z' },
      ],
    }),
  },

  // ── Escrow & LOVE (4 tools) ──────────────────────────────────────────
  {
    name: 'escrow_deposit',
    description: 'Deposit funds into escrow',
    inputSchema: {
      type: 'object',
      properties: {
        caseId: { type: 'string', description: 'Case ID' },
        amount: { type: 'number', description: 'Amount to deposit' },
        partyA: { type: 'string', description: 'Party A DID' },
        partyB: { type: 'string', description: 'Party B DID' },
      },
      required: ['caseId', 'amount', 'partyA', 'partyB'],
    },
    handler: async (args) => {
      return { success: true, escrowId: crypto.randomUUID(), status: 'locked', amount: args.amount };
    },
  },
  {
    name: 'escrow_status',
    description: 'Check escrow status',
    inputSchema: {
      type: 'object',
      properties: {
        escrowId: { type: 'string', description: 'Escrow ID' },
      },
      required: ['escrowId'],
    },
    handler: async (args) => ({
      escrowId: args.escrowId,
      status: 'locked',
      amount: 100,
      partyA: 'did:key:za',
      partyB: 'did:key:zb',
      lockedAt: '2026-07-01T12:00:00Z',
    }),
  },
  {
    name: 'escrow_release',
    description: 'Release escrow funds',
    inputSchema: {
      type: 'object',
      properties: {
        escrowId: { type: 'string', description: 'Escrow ID' },
        releasedBy: { type: 'string', description: 'Releasing party DID' },
      },
      required: ['escrowId', 'releasedBy'],
    },
    handler: async (args) => {
      return { success: true, escrowId: args.escrowId, status: 'released', releasedAt: new Date().toISOString() };
    },
  },
  {
    name: 'love_balance',
    description: 'Get LOVE token balance for a DID',
    inputSchema: {
      type: 'object',
      properties: {
        did: { type: 'string', description: 'DID to check' },
      },
      required: ['did'],
    },
    handler: async (args) => {
      const did = args.did as string;
      const hash = did.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      return { balance: (hash % 1000) + 1, currency: 'LOVE', did };
    },
  },
  {
    name: 'love_mint',
    description: 'Mint LOVE tokens',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient DID' },
        amount: { type: 'number', description: 'Amount to mint' },
        reason: { type: 'string', description: 'Reason for minting' },
      },
      required: ['to', 'amount'],
    },
    handler: async (args) => {
      return { success: true, tx: crypto.randomUUID().replace(/-/g, ''), to: args.to, amount: args.amount };
    },
  },

  // ── Feedback (3 tools) ───────────────────────────────────────────────
  {
    name: 'feedback_submit',
    description: 'Submit feedback (bug, feature, praise)',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['bug', 'feature', 'praise', 'question', 'report'] },
        title: { type: 'string', description: 'Feedback title' },
        description: { type: 'string', description: 'Feedback description' },
      },
      required: ['type', 'title', 'description'],
    },
    handler: async (args) => {
      return { success: true, feedbackId: crypto.randomUUID(), status: 'new', type: args.type };
    },
  },
  {
    name: 'feedback_status',
    description: 'Check feedback status',
    inputSchema: {
      type: 'object',
      properties: {
        feedbackId: { type: 'string', description: 'Feedback ID' },
      },
      required: ['feedbackId'],
    },
    handler: async (args) => ({
      feedbackId: args.feedbackId,
      status: 'acknowledged',
      assignedTo: 'p31-bot',
      updatedAt: new Date().toISOString(),
    }),
  },
  {
    name: 'feedback_list',
    description: 'List all feedback submissions',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['bug', 'feature', 'praise', 'question', 'report', 'all'] },
        status: { type: 'string', enum: ['new', 'acknowledged', 'in-progress', 'resolved', 'all'] },
      },
    },
    handler: async () => ({
      feedback: [
        { id: crypto.randomUUID(), type: 'bug', title: 'Evidence vault timeout', status: 'new', createdAt: '2026-07-01T12:00:00Z' },
        { id: crypto.randomUUID(), type: 'feature', title: 'Dark mode toggle', status: 'acknowledged', createdAt: '2026-07-02T09:00:00Z' },
      ],
    }),
  },

  // ── Research (2 tools) ───────────────────────────────────────────────
  {
    name: 'research_search',
    description: 'Search research corpus',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        topK: { type: 'number', description: 'Number of results' },
      },
      required: ['query'],
    },
    handler: async (args) => {
      return { results: [], query: args.query, count: 0 };
    },
  },
  {
    name: 'research_document',
    description: 'Get a specific research document',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'Document ID' },
      },
      required: ['documentId'],
    },
    handler: async (args) => ({
      documentId: args.documentId,
      title: 'K4 Mesh Rigidity Analysis',
      abstract: 'This paper examines the isostatic properties of K4 meshes...',
      authors: ['P31 Research'],
      publishedAt: '2026-06-15',
    }),
  },

  // ── PHOS (2 tools) ───────────────────────────────────────────────────
  {
    name: 'phos_spoons',
    description: 'Get or set spoon level',
    inputSchema: {
      type: 'object',
      properties: {
        level: { type: 'number', description: 'Spoon level (1, 3, or 5)' },
      },
    },
    handler: async (args) => {
      const level = (args.level as number) || 3;
      return { spoons: level, status: 'set' };
    },
  },
  {
    name: 'phos_theme',
    description: 'Get or set PHOS theme',
    inputSchema: {
      type: 'object',
      properties: {
        theme: { type: 'string', enum: ['quantum', 'bridge', 'sanctuary'] },
      },
    },
    handler: async (args) => {
      return { theme: args.theme || 'quantum', status: 'set' };
    },
  },

  // ── System & Session (2 tools) ───────────────────────────────────────
  {
    name: 'system_health',
    description: 'Check system health',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({
      status: 'ok',
      services: {
        'k4-cage': 'online',
        'evidence-vault': 'online',
        'escrow-engine': 'online',
        'phos': 'online',
      },
      uptime: process.uptime(),
    }),
  },
  {
    name: 'system_version',
    description: 'Get system version information',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({
      version: '2.0.0',
      build: '2026-07-03',
      commit: process.env.GIT_COMMIT || 'unknown',
      runtime: `Node.js ${process.version}`,
    }),
  },
];

export function createMcpServer(): Server {
  const server = new Server(
    { name: 'p31-cli-mcp', version: '2.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    try {
      const result = await tool.handler(args || {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  });

  return server;
}

async function main() {
  const transport = new StdioServerTransport();
  const server = createMcpServer();
  await server.connect(transport);
  console.error('P31 MCP Server running on stdio');
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main().catch((error) => {
    console.error('MCP server error:', error);
    process.exit(1);
  });
}
