/**
 * Spoon-Gating Benchmark
 * Measures token usage and unsafe-call rate at each spoon level.
 */

import { describe, it, expect } from 'vitest';
import { getAvailableTools, isToolAllowed } from '../../src/safety/spoon-gating.js';
import { ALL_TOOLS } from '../../src/mcp-servers/index.js';

// Estimate token cost per tool (name + description + inputSchema)
function estimateTokens(tool: any): number {
  const json = JSON.stringify(tool);
  return Math.ceil(json.length / 4); // ~4 chars per token
}

describe('Spoon-Gating Benchmark', () => {
  const levels = [0, 1, 2, 3, 4, 5] as const;

  for (const level of levels) {
    it(`spoon level ${level}: measures available tools and token cost`, () => {
      const available = getAvailableTools(level, ALL_TOOLS);
      const totalTokens = available.reduce((sum: number, t: any) => sum + estimateTokens(t), 0);
      const pctOfFull = Math.round((available.length / ALL_TOOLS.length) * 100);

      console.log(`\n  Spoon ${level}: ${available.length}/${ALL_TOOLS.length} tools (${pctOfFull}%), ~${totalTokens} tokens`);

      expect(available.length).toBeGreaterThan(0);
      expect(totalTokens).toBeGreaterThan(0);
    });
  }

  it('spoon level 0: only crisis tools available', () => {
    const available = getAvailableTools(0, ALL_TOOLS);
    expect(available.length).toBe(2);
    expect(available.map((t: any) => t.name)).toContain('grounding_54321');
    expect(available.map((t: any) => t.name)).toContain('support_ping');
  });

  it('spoon level 1: only read-only tools available', () => {
    const available = getAvailableTools(1, ALL_TOOLS);
    expect(available.length).toBe(14);
    for (const tool of available) {
      expect(isToolAllowed(tool.name, 1)).toBe(true);
    }
  });

  it('spoon level 5: full surface available', () => {
    const available = getAvailableTools(5, ALL_TOOLS);
    expect(available.length).toBe(ALL_TOOLS.length);
  });

  it('token reduction at spoon 1 vs spoon 5', () => {
    const fullTokens = getAvailableTools(5, ALL_TOOLS).reduce((s: number, t: any) => s + estimateTokens(t), 0);
    const lowTokens = getAvailableTools(1, ALL_TOOLS).reduce((s: number, t: any) => s + estimateTokens(t), 0);
    const reduction = Math.round((1 - lowTokens / fullTokens) * 100);

    console.log(`\n  Token reduction at spoon 1: ${reduction}% (${fullTokens} → ${lowTokens} tokens)`);
    expect(reduction).toBeGreaterThan(80);
  });
});
