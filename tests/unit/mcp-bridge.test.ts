import { describe, it, expect } from 'vitest';
import { TOOLS, ALL_TOOLS, TOOL_CATEGORIES, TOTAL_TOOL_COUNT } from '../../src/mcp-bridge.js';

describe('MCP Bridge', () => {
  it('should export 135 tools', () => {
    expect(TOOLS).toHaveLength(135);
  });

  it('should have all required tool properties', () => {
    for (const tool of TOOLS) {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.category).toBeDefined();
    }
  });

  it('should have unique tool names', () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should cover all 12 categories', () => {
    const categories = [...new Set(TOOL_CATEGORIES.map((c: any) => c.name))];
    expect(categories.length).toBe(12);
  });

  it('should handle search_tools', () => {
    const result = (TOOLS as any).find((t: any) => t.name === 'search_tools');
    expect(result).toBeDefined();
  });

  it('should handle get_tool_details', () => {
    const result = (TOOLS as any).find((t: any) => t.name === 'get_tool_details');
    expect(result).toBeDefined();
  });

  it('should handle assess_capacity', () => {
    const result = (TOOLS as any).find((t: any) => t.name === 'assess_capacity');
    expect(result).toBeDefined();
  });

  it('should handle love_balance', () => {
    const result = (TOOLS as any).find((t: any) => t.name === 'love_balance');
    expect(result).toBeDefined();
  });

  it('should handle oasis_status', () => {
    const result = (TOOLS as any).find((t: any) => t.name === 'oasis_status');
    expect(result).toBeDefined();
  });

  it('should handle crisis_check', () => {
    const result = (TOOLS as any).find((t: any) => t.name === 'crisis_check');
    expect(result).toBeDefined();
  });
});
