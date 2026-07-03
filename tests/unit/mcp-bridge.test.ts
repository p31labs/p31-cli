import { describe, it, expect } from 'vitest';
import { TOOLS } from '../../src/mcp-bridge.js';

describe('MCP Bridge', () => {
  it('should export exactly 26 tools', () => {
    expect(TOOLS).toHaveLength(26);
  });

  it('should have all required tool properties', () => {
    for (const tool of TOOLS) {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(typeof tool.handler).toBe('function');
    }
  });

  it('should have unique tool names', () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should cover all required categories', () => {
    const namePrefixes = TOOLS.map((t) => t.name.split('_')[0]);
    const categories = [...new Set(namePrefixes)];
    expect(categories.sort()).toEqual([
      'escrow', 'evidence', 'feedback', 'love',
      'mesh', 'passport', 'phos', 'research', 'system',
    ]);
  });

  it('should handle passport_create handler', async () => {
    const tool = TOOLS.find((t) => t.name === 'passport_create')!;
    const result = await tool.handler({ displayName: 'Will', pronouns: 'he/him' });
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('did');
    expect((result as any).did).toMatch(/^did:key:z/);
  });

  it('should handle mesh_status handler', async () => {
    const tool = TOOLS.find((t) => t.name === 'mesh_status')!;
    const result = await tool.handler({});
    expect(result).toHaveProperty('topology', 'K4');
    expect(result).toHaveProperty('vertices', 4);
    expect(result).toHaveProperty('edges', 6);
    expect(result).toHaveProperty('rigidity', 'isostatic');
  });

  it('should handle evidence_upload handler', async () => {
    const tool = TOOLS.find((t) => t.name === 'evidence_upload')!;
    const result = await tool.handler({
      caseId: 'case-001',
      content: 'base64content',
    });
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('evidenceId');
    expect(result).toHaveProperty('chainHash');
  });

  it('should handle escrow_deposit handler', async () => {
    const tool = TOOLS.find((t) => t.name === 'escrow_deposit')!;
    const result = await tool.handler({
      caseId: 'case-001',
      amount: 100,
      partyA: 'did:key:za',
      partyB: 'did:key:zb',
    });
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('escrowId');
    expect(result).toHaveProperty('status', 'locked');
  });

  it('should handle system_health handler', async () => {
    const tool = TOOLS.find((t) => t.name === 'system_health')!;
    const result = await tool.handler({});
    expect(result).toHaveProperty('status', 'ok');
    expect(result).toHaveProperty('services');
    expect((result as any).services).toHaveProperty('k4-cage');
    expect((result as any).services).toHaveProperty('evidence-vault');
    expect((result as any).services).toHaveProperty('escrow-engine');
    expect((result as any).services).toHaveProperty('phos');
  });

  it('should handle love_balance handler', async () => {
    const tool = TOOLS.find((t) => t.name === 'love_balance')!;
    const result = await tool.handler({ did: 'did:key:ztest' });
    expect(result).toHaveProperty('balance');
    expect(result).toHaveProperty('currency', 'LOVE');
    expect(typeof (result as any).balance).toBe('number');
  });
});
