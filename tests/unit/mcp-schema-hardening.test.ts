/**
 * MCP Tool Schema Hardening — Audit all 133 tools for agent reliability
 * Based on MCP spec 2025-11-25 and production best practices
 */

import { describe, it, expect } from 'vitest';
import { ALL_TOOLS } from '../../src/mcp-servers/index.js';

describe('MCP Tool Schema Hardening', () => {
  it('every tool has a description of at least 30 characters', () => {
    for (const tool of ALL_TOOLS) {
      expect(
        tool.description?.length ?? 0,
        `${tool.name} description is too short`
      ).toBeGreaterThanOrEqual(30);
    }
  });

  it('every inputSchema property has a description', () => {
    for (const tool of ALL_TOOLS) {
      const props = tool.inputSchema?.properties ?? {};
      for (const [key, prop] of Object.entries(props)) {
        expect(
          (prop as any).description,
          `${tool.name}.${key} is missing a description`
        ).toBeDefined();
      }
    }
  });

  it('all tool names match ^[A-Za-z0-9_./-]+$', () => {
    const validName = /^[A-Za-z0-9_./-]+$/;
    for (const tool of ALL_TOOLS) {
      expect(tool.name).toMatch(validName);
    }
  });

  it('every tool has a human-readable title', () => {
    for (const tool of ALL_TOOLS) {
      expect(
        (tool as any).title,
        `${tool.name} is missing a title field`
      ).toBeDefined();
    }
  });

  it('read-only tools carry annotations', () => {
    const readOnlyTools = [
      'oasis_status', 'truth_lookup', 'truth_facts', 'love_balance',
      'dome_structure', 'design_expert_check_contrast',
      'truth_health', 'soulsafe_protocol_info',
    ];
    for (const name of readOnlyTools) {
      const tool = ALL_TOOLS.find(t => t.name === name);
      if (!tool) continue;
      expect(
        (tool as any).annotations?.readOnlyHint,
        `${name} should have readOnlyHint: true`
      ).toBe(true);
    }
  });

  it('descriptions contain a return-signal verb', () => {
    const returnVerbs = /\b(returns?|response|output|provides?|reports?|gets?|fetches?|lists?)\b/i;
    for (const tool of ALL_TOOLS) {
      expect(
        returnVerbs.test(tool.description ?? ''),
        `${tool.name} description lacks a return-signal verb`
      ).toBe(true);
    }
  });

  it('all tools have inputSchema.type === "object"', () => {
    for (const tool of ALL_TOOLS) {
      expect(
        tool.inputSchema?.type,
        `${tool.name} inputSchema.type should be "object"`
      ).toBe('object');
    }
  });
});
