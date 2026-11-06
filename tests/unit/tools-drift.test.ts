import { describe, it, expect } from 'vitest';
import { TOOLS } from '../../src/mcp-bridge.js';
import toolsJson from '../../mcp/tools.json' with { type: 'json' };

describe('Tools Drift', () => {
  it('should have matching tool names between mcp-bridge.ts and tools.json', () => {
    const jsonNames = new Set(toolsJson.tools.map((t: any) => t.name));
    const codeNames = new Set(TOOLS.map((t) => t.name));
    expect(jsonNames).toEqual(codeNames);
  });

  it('should have matching inputSchema between mcp-bridge.ts and tools.json', () => {
    const jsonTools = new Map(toolsJson.tools.map((t: any) => [t.name, t.inputSchema || { type: 'object', properties: {} }]));
    for (const tool of TOOLS) {
      const jsonSchema = jsonTools.get(tool.name);
      expect(jsonSchema).toBeDefined();

      // Structural properties (functional, not documentation)
      expect(tool.inputSchema.type).toBe(jsonSchema?.type);
      expect(tool.inputSchema.required).toEqual(jsonSchema?.required);

      const codeProps = Object.entries(tool.inputSchema.properties);
      const jsonProps = Object.entries(jsonSchema?.properties || {});
      expect(codeProps).toHaveLength(jsonProps.length);

      for (const [key, codeVal] of codeProps) {
        const jsonVal = jsonProps.find(([k]) => k === key)?.[1];
        expect(jsonVal).toBeDefined();
        expect(codeVal.type).toBe(jsonVal.type);
        expect(codeVal.enum).toEqual(jsonVal.enum);
      }
    }
  });

  it('should have matching descriptions between mcp-bridge.ts and tools.json', () => {
    const jsonTools = new Map(toolsJson.tools.map((t: any) => [t.name, t.description]));
    for (const tool of TOOLS) {
      const jsonDesc = jsonTools.get(tool.name);
      expect(jsonDesc).toBeDefined();
      if (jsonDesc) {
        expect(tool.description).toBe(jsonDesc);
      }
    }
  });
});
